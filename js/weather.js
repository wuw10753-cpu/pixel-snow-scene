// weather.js —— 天气循环：用一条「A 型包络」同时驱动降雪量与积雪高度
//
// 包络 W(t) ∈ [0,1]，形状是重复的 A 字：
//
//   W
//   1 |          ┌────┐
//     |         /      \
//     |        /        \
//   0 |_______/          \______________________
//     |← 上升 →|←停留→|←下降→|←──────── 晴天 ────────→
//
// 一条曲线控制两件事，所以它们天然同步：
//   降雪量   = 基准发射量 × W      → W = 0 时不下雪
//   积雪目标 = 峰值积雪高度 × W    → W = 0 时雪地化光
//
// 于是「下雪 → 积雪 → 雪停 → 融化 → 晴天」不需要分别写逻辑，只靠这一条曲线。

// 平滑函数：把 u ∈ [0,1] 变成 S 形（慢起、中段快、慢收）
// 直接用线性 u 也行，但 A 字的角和峰顶会很生硬
function smoothstep(u) {
  return u * u * (3 - 2 * u);
}

function createWeatherState() {
  return {
    time: 0,        // 当前处在周期内的位置（秒）
    intensity: 1,   // 当前强度 W
    phase: '上升',   // 当前阶段名（面板上显示用）
  };
}

// 推进天气：算出这一帧的强度 W 和所处阶段
function updateWeather(state, dt) {
  const W = CONFIG.WEATHER;
  const total = W.RISE + W.HOLD + W.FALL + W.CLEAR;   // 一个完整周期长度

  if (total <= 0) {
    state.intensity = 1;
    state.phase = '恒定';
    return;
  }

  // 取模 = 循环：走完一个周期回到起点
  state.time = (state.time + dt) % total;
  const t = state.time;

  if (t < W.RISE) {
    // ① 上升：雪从无到峰值
    state.intensity = smoothstep(t / W.RISE);
    state.phase = '上升';
  } else if (t < W.RISE + W.HOLD) {
    // ② 峰值停留：雪最大、雪地铺满
    state.intensity = 1;
    state.phase = '峰值';
  } else if (t < W.RISE + W.HOLD + W.FALL) {
    // ③ 下降：雪在变小，雪地开始融化
    const u = (t - W.RISE - W.HOLD) / W.FALL;
    state.intensity = 1 - smoothstep(u);
    state.phase = '下降';
  } else {
    // ④ 晴天：不下雪，残留的雪继续融化
    state.intensity = 0;
    state.phase = '晴天';
  }

  // 峰值倍率：> 1 表示这一场雪下得更猛
  state.intensity *= W.PEAK_INTENSITY;
}