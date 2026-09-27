// config.js —— 所有可调参数集中于此
// 想调整游戏表现（尺寸/颜色/大小），只改这里，不动逻辑代码
// 雪天相关参数也在这里，右下角的控制面板（panel.js）会直接改这些值

const CONFIG = {
  // 画布尺寸（px）
  CANVAS_WIDTH: 640,
  CANVAS_HEIGHT: 448,

  // 小人像素块大小：矩阵里 1 格放大成 PIXEL_SIZE × PIXEL_SIZE
  PIXEL_SIZE: 8,

  // 草地配色：底色 + 深浅点缀（用于画草纹理）
  GRASS_BASE: '#5a9e36',
  GRASS_LIGHT: '#7cc24b',
  GRASS_DARK: '#3f7d24',

  // 小人初始位置（矩阵左上角所在的画布像素坐标）
  // 小人尺寸 = 8 格 × 12 格 × PIXEL_SIZE = 64 × 96 px，此处让其水平居中
  PLAYER_SPAWN_X: 288,
  PLAYER_SPAWN_Y: 176,

  // 小人移动速度：每帧移动的像素数（当前约 60 帧/秒，即 120 px/秒）
  PLAYER_SPEED: 2,

  // —— 雪的颜色（分层：空中雪花比地面积雪更亮）——
  // 地面积雪：偏灰的冷白，哑光、低亮度（比雪花暗一档，拉开层次）
  SNOW_GROUND_COLOR: '#dde9f0',
  // 雪花：纯白，亮度高于地面 → 一眼能看出正在飘落的雪
  SNOW_COLOR: '#ffffff',
  // 积雪边缘的淡蓝，做出厚度感
  SNOW_EDGE_COLOR: '#c8e4f5',

  // 场景里的树（静态物体，可自行增删）
  // x / y = 矩阵左上角坐标，scale = 每格放大倍数
  TREES: [
    { x: 48, y: 240, scale: 8 },
    { x: 496, y: 208, scale: 8 },
  ],

  // —— 雪花粒子系统 ——
  // 单位说明：速度 = px/秒，加速度 = px/秒²，时间 = 秒
  SNOW: {
    SPAWN_PER_SECOND: 60,   // 发射量：每秒生成多少片雪花
    SPAWN_Y: -16,           // 出生高度（负值 = 画布上方之外）
    SPAWN_MARGIN: 32,       // 出生区域左右各超出画布多少（让风把雪吹进来）

    FALL_SPEED_MIN: 30,     // 下落初速度范围（Y 轴向下）
    FALL_SPEED_MAX: 80,
    DRIFT_SPEED: 25,        // 自身水平飘动幅度（与风无关的那部分）
    GRAVITY: 20,            // 重力加速度，让雪花越落越快

    LIFE_MIN: 3,            // 生命周期范围
    LIFE_MAX: 8,
    FADE_IN: 0.5,           // 出生后淡入时长
    FADE_OUT: 1,            // 消失前淡出时长

    WIND_BASE: 20,          // 风力基准值（正 = 向右吹）
    WIND_AMPLITUDE: 30,     // 风力摆动幅度（阵风强弱）
    WIND_PERIOD: 6,         // 风力摆动周期（秒）

    SHAPE_SCALE: 1,         // 每格放大倍数（1 = 1 像素，保持像素风）

    // —— 雪花亮度分层（把「空中雪花」和「地面积雪」分开）——
    BRIGHT_MIN: 0.95,       // 每片雪花的基础亮度下限（1 = 纯白）
    BRIGHT_MAX: 1,          // 上限
    FLICKER: 1,             // 闪烁幅度：在自身亮度上下浮动的比例（1 = 覆盖整个色阶，0 = 不闪）
    FLICKER_SPEED: 2.5,     // 闪烁快慢（次/秒）
  },

  // —— 天气循环（A 型包络）——
  // 一条曲线同时驱动「降雪量」和「积雪高度」：
  // 雪很少 → 越下越大 → 峰值（雪地铺满）→ 雪变小 → 融化 → 晴天间隔 → 循环
  WEATHER: {
    ENABLED: true,        // 关掉就退回手动静态雪天（积雪高度滑块直接生效）
    RISE: 16,             // 上升时长（秒）
    HOLD: 6,              // 峰值停留时长（秒）
    FALL: 20,             // 下降时长（秒）
    CLEAR: 36,            // 晴天时长（秒）：不下雪，残留的雪继续融化
    PEAK_INTENSITY: 1,    // 峰值强度倍率（1 = 用基准发射量，2 = 双倍）
    PEAK_COVER: 1,        // 峰值时的积雪高度（1 = 布满整个画布）
  },

  // —— 积雪 ——
  SNOW_COVER: {
    GROUND_HEIGHT: 0.28,    // 手动模式的积雪高度（只在天气循环关闭时生效）
    GROUND_JITTER: 14,      // 雪线上下抖动幅度（px），避免雪线是条直线
    OBJECT_COVERAGE: 0.8,   // 物体朝上表面的覆雪概率（0~1）
    CHANGE_RATE: 0.05,      // 堆积/消融速度（比例/秒）：调小后雪地会明显滞后于天气变化
  },
};

window.CONFIG = CONFIG;