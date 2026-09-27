// main.js —— 游戏入口：状态 → 输入 → 更新 → 绘制
// 主循环三拍：update() 改状态，render() 画状态

// ① 状态：所有「会变的数据」集中在这里，渲染只读它
const player = {
  x: CONFIG.PLAYER_SPAWN_X,
  y: CONFIG.PLAYER_SPAWN_Y,
};

// ② 雪天状态（粒子数组等）由 particles.js 提供
const snow = createSnowState();

// 天气状态（A 型包络的进度）由 weather.js 提供
const weather = createWeatherState();

// ?peak 快捷演示：把天气包络定位到峰值、积雪设满、发射量加倍
// 用途：README 截图 / 演示 / 调试——不用等完整 78 秒周期
const _params = new URLSearchParams(location.search);
if (_params.has('peak')) {
  weather.time = CONFIG.WEATHER.RISE + 0.5;  // 进入峰值段
  snow.cover = 0.8;                            // 雪地停在 80%（露出人物、树）
  CONFIG.WEATHER.PEAK_COVER = 0.8;             // 同步目标，避免被包络立刻拉回 1
  CONFIG.SNOW.SPAWN_PER_SECOND *= 2;           // 雪下得更密
  const _n = Number(_params.get('warmup'));
  if (_n > 0) {                                // 预生成 N 片雪花（截图/演示用，跳过等待）
    for (let i = 0; i < _n; i++) {
      const p = spawnParticle();
      p.y = Math.random() * CONFIG.CANVAS_HEIGHT;
      p.age = 1; p.alpha = 1;
      snow.particles.push(p);
    }
  }
}

// ② 输入：用 Set 记录「当前按住的键」
// 为什么不在 keydown 里直接移动？因为按住不放时 keydown 会重复触发、间隔不匀，
// 而每帧读一次 Set 才是匀速的
const keys = new Set();

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  // 方向键默认会滚动页面，屏蔽掉
  if (e.code.startsWith('Arrow')) e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

// ③ 更新：只改状态，不画东西
function update() {
  // 注意这里用 dx/dy（增量）而不是直接赋值，这样斜向按两个键时也是「各走各的」
  let dx = 0;
  let dy = 0;

  if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;

  player.x += dx * CONFIG.PLAYER_SPEED;
  player.y += dy * CONFIG.PLAYER_SPEED;

  // 边界限制：按矩阵算真实尺寸，不让小人走出画布
  const playerWidth = PLAYER_PIXELS[0].length * CONFIG.PIXEL_SIZE;
  const playerHeight = PLAYER_PIXELS.length * CONFIG.PIXEL_SIZE;
  player.x = Math.max(0, Math.min(CONFIG.CANVAS_WIDTH - playerWidth, player.x));
  player.y = Math.max(0, Math.min(CONFIG.CANVAS_HEIGHT - playerHeight, player.y));
}

function init() {
  const canvas = document.getElementById('game');
  canvas.width = CONFIG.CANVAS_WIDTH;
  canvas.height = CONFIG.CANVAS_HEIGHT;
  return canvas.getContext('2d');
}

const ctx = init();

// ④ 主循环
// 雪花的物理按「秒」算，所以这里算一个 dt（距上一帧过了多少秒）传下去
// （小人移动目前还是按帧的，先不动它，保持之前验证过的行为）
let lastTime = performance.now();

function loop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;

  // 限幅：切到别的标签页再回来时 dt 会很大，不限幅雪花会瞬移
  if (dt > 0.05) dt = 0.05;

  // 天气循环：算出这一刻的强度。它同时决定「下多大」和「雪地多厚」，
  // 所以下雪、积雪、融化天然同步，不需要分别写逻辑
  updateWeather(weather, dt);
  const intensity = CONFIG.WEATHER.ENABLED ? weather.intensity : 1;
  const targetCover = CONFIG.WEATHER.ENABLED
    ? CONFIG.WEATHER.PEAK_COVER * intensity   // 天气模式：峰值积雪 × 当前强度
    : CONFIG.SNOW_COVER.GROUND_HEIGHT;        // 手动模式：滑块直接生效

  update();                                  // 小人
  updateSnow(snow, dt, intensity);           // 雪花粒子（强度 0 时不再出生新雪）
  updateSnowCover(snow, dt, targetCover);    // 地面积雪的堆积 / 消融
  updatePanelReadout(weather, intensity);    // 面板上的天气读数
  render(ctx, player, snow);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);