// particles.js —— 雪花粒子系统
// 设计：粒子是「纯数据」（普通对象），state.particles 是数组
// 流程：spawn 出生 → update 每帧推进 → 生命结束或落出画布就删除
// 对应你流程里的「GPU 粒子节点」：我们这里是 CPU 粒子，几百片完全跑得动

// —— 雪花亮度分层 ——
// 地面静态积雪是哑光冷白（CONFIG.SNOW_GROUND_COLOR = #e8f0f4，偏灰偏暗），
// 空中雪花是更亮的「动态白」。色相几乎一样，但亮度不同 → 一眼能分出正在飘落的雪。
// 这里预生成一张色阶表：最暗端 = rgb(242,250,255)（即 0.95/0.98/1.0 的冷白），
// 最亮端 = 纯白。每片雪花随机取一档，再叠加微小闪烁。
const SNOW_LEVELS = 16;      // 色阶级数
const LEVEL_DIM = [242, 250, 255];  // 最暗一档（对应亮度 0.95）
const LEVEL_BRIGHT = [255, 255, 255]; // 最亮一档（亮度 1.0）
const DIM_BRIGHTNESS = 0.95; // 最暗一档对应的「亮度」值，用于把亮度换算成级号

let snowPaletteCache = null;

// 生成色阶表（16 级，从冷暗白到纯白）。参数不变就复用，不重复计算
function getSnowPalette() {
  const S = CONFIG.SNOW;
  const key = S.BRIGHT_MIN + '/' + S.BRIGHT_MAX;
  if (snowPaletteCache && snowPaletteCache.key === key) return snowPaletteCache.list;

  const list = [];
  for (let i = 0; i < SNOW_LEVELS; i++) {
    const u = i / (SNOW_LEVELS - 1);
    const r = Math.round(LEVEL_DIM[0] + (LEVEL_BRIGHT[0] - LEVEL_DIM[0]) * u);
    const g = Math.round(LEVEL_DIM[1] + (LEVEL_BRIGHT[1] - LEVEL_DIM[1]) * u);
    const b = Math.round(LEVEL_DIM[2] + (LEVEL_BRIGHT[2] - LEVEL_DIM[2]) * u);
    list.push('rgb(' + r + ',' + g + ',' + b + ')');
  }
  snowPaletteCache = { key: key, list: list };
  return list;
}

// 把「亮度」(0.95 ~ 1.0) 折算成色阶级号 (0 ~ 15)
function brightnessToLevel(brightness) {
  const u = (brightness - DIM_BRIGHTNESS) / (1 - DIM_BRIGHTNESS);
  return Math.max(0, Math.min(SNOW_LEVELS - 1, Math.round(u * (SNOW_LEVELS - 1))));
}

// 创建一份雪天状态（整个游戏只需要一份）
function createSnowState() {
  return {
    particles: [],   // 所有活着的雪花
    accumulator: 0,  // 发射累加器：把「每秒 N 片」摊到每一帧，避免小数被丢掉
    time: 0,         // 累计时间（秒）：驱动阵风与亮度闪烁
    wind: 0,         // 当前风力（px/秒），每帧由阵风公式算出
    // 初值：天气循环开启时从 0 起步（周期起点 W=0，雪地自然应该没雪）
    //       关闭时才用手动滑块的积雪高度
    cover: CONFIG.WEATHER.ENABLED ? 0 : CONFIG.SNOW_COVER.GROUND_HEIGHT,
  };
}

// 出生一片雪花：位置、初速、生命、形态、亮度都在这里随机
// 这里用 Math.random() 是安全的 —— 粒子本来每帧都在动，不像草地那样怕「闪」
function spawnParticle() {
  const S = CONFIG.SNOW;
  const life = S.LIFE_MIN + Math.random() * (S.LIFE_MAX - S.LIFE_MIN);

  // 亮度分层：每片雪花随机一个基础亮度档 + 一个独立的闪烁相位
  const bMin = Math.min(S.BRIGHT_MIN, S.BRIGHT_MAX);
  const bMax = Math.max(S.BRIGHT_MIN, S.BRIGHT_MAX);
  const brightness = bMin + Math.random() * (bMax - bMin);

  return {
    // 出生点在画布上方，左右各超出 SPAWN_MARGIN，让风把雪吹进画面
    x: -S.SPAWN_MARGIN + Math.random() * (CONFIG.CANVAS_WIDTH + S.SPAWN_MARGIN * 2),
    y: S.SPAWN_Y,
    vy: S.FALL_SPEED_MIN + Math.random() * (S.FALL_SPEED_MAX - S.FALL_SPEED_MIN),
    drift: (Math.random() * 2 - 1) * S.DRIFT_SPEED, // 自身的水平飘动，与风叠加
    life: life,
    age: 0,
    alpha: 0,
    shape: Math.floor(Math.random() * SNOW_SHAPES.length), // 随机挑一种雪花形态
    level: brightnessToLevel(brightness),                  // 亮度档（0 = 最暗，15 = 纯白）
    flickerPhase: Math.random() * Math.PI * 2,             // 闪烁相位，让每片零散地闪
  };
}

// 每帧推进：① 发射 ② 算风 ③ 逐片更新
// intensity 是天气强度（0 = 不下雪，1 = 基准发射量，>1 = 下得更猛）
function updateSnow(state, dt, intensity) {
  const S = CONFIG.SNOW;

  // ① 发射：累加小数，攒够 1 片就出生一片（这样 60/秒 才不会被取整成 0）
  state.accumulator += S.SPAWN_PER_SECOND * intensity * dt;
  while (state.accumulator >= 1) {
    state.accumulator -= 1;
    state.particles.push(spawnParticle());
  }

  // ② 阵风：用正弦让风力周期性起伏，模拟自然风的强弱变化
  state.wind = S.WIND_BASE + S.WIND_AMPLITUDE * Math.sin((state.time / S.WIND_PERIOD) * Math.PI * 2);
  state.time += dt;

  // ③ 逐片推进（实现在下面，拆开是为了让本函数只管「发射 + 风」）
  updateSnowParticles(state, S, dt);
}

// 逐片推进雪花：物理 + 生命周期 + 回收
function updateSnowParticles(state, S, dt) {
  // 倒序遍历：从最后一个粒子向前循环（循环里要删元素，正序删会漏元素）
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];

    // 1. 物理：重力、横向漂移、位置
    p.vy += S.GRAVITY * dt;                // 重力：竖直速度持续增加
    p.x += (p.drift + state.wind) * dt;    // 自身飘动 + 全局风力，左右移动
    p.y += p.vy * dt;                      // 竖直位置，按速度移动

    // 2. 存活时间
    p.age += dt;

    // 3. 透明度：淡入 → 保持完全不透明 → 淡出
    if (p.age < S.FADE_IN) {
      p.alpha = p.age / S.FADE_IN;                    // 0 → 1
    } else if (p.life - p.age < S.FADE_OUT) {
      p.alpha = (p.life - p.age) / S.FADE_OUT;        // 1 → 0
    } else {
      p.alpha = 1;
    }

    // 4. 回收：寿命到 或 已落出画面底部
    if (p.age >= p.life || p.y > CONFIG.CANVAS_HEIGHT + 8) {
      state.particles.splice(i, 1);
    }
  }
}

// 画出所有雪花：按形态矩阵画，并按各自的亮度档上色
function drawSnowParticles(ctx, state) {
  const S = CONFIG.SNOW;
  const palette = getSnowPalette();
  const scale = S.SHAPE_SCALE;
  const omega = S.FLICKER_SPEED * Math.PI * 2;
  const flickerSteps = S.FLICKER * (SNOW_LEVELS - 1); // 闪烁幅度换算成「几档」

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];

    // 亮度闪烁：每片有自己的相位，所以是零散地闪，不会整体一起明暗
    const twinkle = Math.sin(state.time * omega + p.flickerPhase) * flickerSteps;
    const level = Math.max(0, Math.min(SNOW_LEVELS - 1, Math.round(p.level + twinkle)));
    ctx.fillStyle = palette[level];

    // 透明度是每片各自的值，所以要在循环里单独设
    ctx.globalAlpha = p.alpha;

    const shape = SNOW_SHAPES[p.shape];
    // 坐标取整：半像素会糊出灰边，破坏像素风
    const px = Math.round(p.x);
    const py = Math.round(p.y);

    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col] === 0) continue;
        ctx.fillRect(px + col * scale, py + row * scale, scale, scale);
      }
    }
  }

  // 必须还原，否则后面画的树、小人也会跟着半透明
  ctx.globalAlpha = 1;
}

// 积雪的堆积 / 消融：让「实际雪量」朝目标值平滑靠拢
// 拖滑块或天气变化时，就能看到雪慢慢堆起来（积雪）或化掉（消融），而不是瞬间跳变
// targetCover 由调用方给出：
//   天气循环开启 → 「峰值积雪高度 × 当前强度」，所以雪地会随天气涨落
//   天气循环关闭 → 手动滑块的积雪高度
function updateSnowCover(state, dt, targetCover) {
  const C = CONFIG.SNOW_COVER;
  const target = targetCover;
  const step = C.CHANGE_RATE * dt;   // 这一帧最多能变多少

  // CHANGE_RATE = 0 → 瞬间到位（等于关掉堆积动画）
  if (step <= 0) {
    state.cover = target;
    return;
  }

  const diff = target - state.cover;
  if (Math.abs(diff) <= step) {
    state.cover = target;            // 已经很接近，直接贴合，避免永远差一点点
  } else {
    state.cover += diff > 0 ? step : -step;  // diff > 0 → 堆积，diff < 0 → 消融
  }
}