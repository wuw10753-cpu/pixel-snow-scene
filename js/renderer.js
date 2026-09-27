// renderer.js —— 所有「绘制」逻辑集中在这里
// 不存状态、只根据数据把画面画出来，方便扩展与调试
// 绘制顺序（从下到上）：草地 → 地面积雪 → 树 → 小人 → 雪花

// 确定性哈希：同样的 (k, m) 永远得到同样的结果，用于「看着随机但不闪」
// 返回一个 32 位无符号整数
function hashInt(k, m) {
  let h = (k * 73856093) ^ (m * 19349663);
  h ^= h >>> 15;
  h = (h * 2246822519) >>> 0;
  h ^= h >>> 13;
  return h;
}

// 把哈希归一化到 [0, 1)，方便和概率参数比较
function hash01(k, m) {
  return (hashInt(k, m) % 10000) / 10000;
}

// 绘制草地：底色 + 确定性伪随机草点
function drawGrass(ctx) {
  // 第1层：铺整片草地底色
  ctx.fillStyle = CONFIG.GRASS_BASE;
  ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

  // 第2层：撒草点。用「格子序号」算哈希，同一序号结果永远相同 —— 所以不会闪
  const step = 16;                                  // 草点间距，调大更稀疏
  const cols = Math.ceil(CONFIG.CANVAS_WIDTH / step);
  const rows = Math.ceil(CONFIG.CANVAS_HEIGHT / step);

  for (let k = 0; k < cols; k++) {
    for (let m = 0; m < rows; m++) {
      const x = k * step;
      const y = m * step;

      // 哈希：异或两个大质数的乘积打散，再做两次位移混合
      // 目的：让 k、m 的线性关系被彻底破坏，不会退化成斜纹
      let h = hashInt(k, m);

      // 约 1/6 的格子长草
      if (h % 6 !== 0) continue;

      // 深浅色另取 h 的「另一个比特」判断。
      // 注意：不能写 h % 2 —— 走到这里 h 必然是 6 的倍数，判断结果恒真，就成了死分支
      ctx.fillStyle = (h & 2) === 0 ? CONFIG.GRASS_LIGHT : CONFIG.GRASS_DARK;

      ctx.fillRect(x, y, 3, 3);
    }
  }
}

// 绘制地面积雪：在草地上盖一层雪
// 雪线用「多频率正弦叠加」生成起伏，再吸附到整格
// ⚠ 不能用「相邻列各自随机」的抖动：相邻列落差太大会让雪地变成一根根竖条
// 雪量取 state.cover（实际值），它由 updateSnowCover 朝目标值慢慢靠拢 → 有堆积/消融过程
function drawSnowGround(ctx, snow) {
  const C = CONFIG.SNOW_COVER;
  const cell = CONFIG.PIXEL_SIZE;
  const cols = Math.ceil(CONFIG.CANVAS_WIDTH / cell);

  // 雪线基准位置：积雪越厚，雪线越靠上
  const baseLine = CONFIG.CANVAS_HEIGHT * (1 - snow.cover);

  for (let k = 0; k < cols; k++) {
    const x = k * cell;
    const t = k / cols;   // 0 → 1，横向进度

    // 三个不同频率的正弦叠加：既有大起伏也有小褶皱，且相邻列变化平缓
    const wave =
      Math.sin(t * Math.PI * 2 * 2) * 0.5 +
      Math.sin(t * Math.PI * 2 * 5 + 1.3) * 0.3 +
      Math.sin(t * Math.PI * 2 * 9 + 4.1) * 0.2;

    // 吸附到整格：保持像素风，相邻列落差控制在 1 格以内
    const line = Math.round((baseLine + wave * C.GROUND_JITTER) / cell) * cell;

    // 雪线最上沿一格：淡蓝，做出积雪的厚度感
    ctx.fillStyle = CONFIG.SNOW_EDGE_COLOR;
    ctx.fillRect(x, line, cell, cell);

    // 主体：哑光冷白（比空中雪花暗一档）一路填到画布底部
    ctx.fillStyle = CONFIG.SNOW_GROUND_COLOR;
    ctx.fillRect(x, line + cell, cell, CONFIG.CANVAS_HEIGHT - line - cell);
  }
}

// 判断某个物体格子上是否应该有积雪
// 返回 true → 这一格画成雪（白），false → 画它本来的颜色
function isSnowTopped(matrix, row, col) {
  // 1. 本格必须是实心的
  if (matrix[row][col] === 0) return false;

  // 2. 「朝上表面」判定：正上方那一格是空的（row 0 视为最顶层，上方即天空）
  //    反例：树干顶上的格子上面压着树叶 → 不是朝上表面 → 不积雪
  const aboveIsEmpty = row === 0 || matrix[row - 1][col] === 0;
  if (!aboveIsEmpty) return false;

  // 3. 覆盖率：用确定性哈希决定（不能用 Math.random，否则雪会忽有忽无地闪）
  return hash01(row, col) < CONFIG.SNOW_COVER.OBJECT_COVERAGE;
}

// 绘制一棵树（含树上的积雪）
function drawTree(ctx, tree) {
  const s = tree.scale;
  for (let row = 0; row < TREE_PIXELS.length; row++) {
    for (let col = 0; col < TREE_PIXELS[row].length; col++) {
      const code = TREE_PIXELS[row][col];
      if (code === 0) continue;

      // 该格子该不该覆雪，交给 isSnowTopped 判断
      ctx.fillStyle = isSnowTopped(TREE_PIXELS, row, col)
        ? CONFIG.SNOW_GROUND_COLOR
        : TREE_COLORS[code];

      ctx.fillRect(tree.x + col * s, tree.y + row * s, s, s);
    }
  }
}

// 绘制场上所有的树
function drawTrees(ctx) {
  for (let i = 0; i < CONFIG.TREES.length; i++) {
    drawTree(ctx, CONFIG.TREES[i]);
  }
}

// 绘制小人：双层循环遍历像素矩阵
// player 是状态对象，位置由它提供，渲染只读不写
function drawPlayer(ctx, player) {
  // 外层循环：遍历每一行 row
  for (let row = 0; row < PLAYER_PIXELS.length; row++) {
    // 内层循环：遍历当前行的每一列 col
    for (let col = 0; col < PLAYER_PIXELS[row].length; col++) {
      // 获取当前格子的颜色编号
      const code = PLAYER_PIXELS[row][col];
      // code=0 代表空白，跳过，不绘制
      if (code === 0) continue;

      // 设置画笔颜色：朝上的表面（头顶、肩膀）会带雪，和树用同一套判定
      ctx.fillStyle = isSnowTopped(PLAYER_PIXELS, row, col)
        ? CONFIG.SNOW_GROUND_COLOR
        : PLAYER_COLORS[code];

      // 计算屏幕坐标：当前位置 + 格子偏移
      const x = player.x + col * CONFIG.PIXEL_SIZE;
      const y = player.y + row * CONFIG.PIXEL_SIZE;

      // 绘制单个像素方块
      ctx.fillRect(x, y, CONFIG.PIXEL_SIZE, CONFIG.PIXEL_SIZE);
    }
  }
}

// 每帧总入口
function render(ctx, player, snow) {
  ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

  drawGrass(ctx);               // 草地
  drawSnowGround(ctx, snow);    // 地面积雪（盖在草地上）
  drawTrees(ctx);               // 树 + 树上的积雪
  drawPlayer(ctx, player);      // 小人（含头顶积雪）
  drawSnowParticles(ctx, snow); // 雪花飘在最上层
}