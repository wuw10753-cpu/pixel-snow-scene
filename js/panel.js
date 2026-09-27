// panel.js —— 调试控制面板
// 把 CONFIG 里的数值参数映射成滑块 / 开关，改动即刻生效（不用重启、不用改代码）
// 原理：逻辑代码每帧都读 CONFIG，所以「改 CONFIG」= 实时生效

const PANEL_ITEMS = [
  // 天气循环（A 型包络）
  { path: 'WEATHER.ENABLED', label: '天气循环', type: 'toggle' },
  { path: 'WEATHER.RISE', label: '上升时长（秒）', min: 1, max: 40, step: 1 },
  { path: 'WEATHER.HOLD', label: '峰值停留（秒）', min: 0, max: 20, step: 1 },
  { path: 'WEATHER.FALL', label: '下降时长（秒）', min: 1, max: 40, step: 1 },
  { path: 'WEATHER.CLEAR', label: '晴天时长（秒）', min: 0, max: 60, step: 1 },
  { path: 'WEATHER.PEAK_INTENSITY', label: '峰值强度倍率', min: 0, max: 2, step: 0.1 },
  { path: 'WEATHER.PEAK_COVER', label: '峰值积雪高度', min: 0, max: 1, step: 0.05 },

  // 雪花粒子
  { path: 'SNOW.SPAWN_PER_SECOND', label: '发射量（片/秒）', min: 0, max: 400, step: 10 },
  { path: 'SNOW.GRAVITY', label: '重力', min: 0, max: 200, step: 5 },
  { path: 'SNOW.FALL_SPEED_MIN', label: '下落初速（慢）', min: 0, max: 200, step: 5 },
  { path: 'SNOW.FALL_SPEED_MAX', label: '下落初速（快）', min: 0, max: 300, step: 5 },
  { path: 'SNOW.DRIFT_SPEED', label: '自身飘动', min: 0, max: 100, step: 5 },
  { path: 'SNOW.WIND_BASE', label: '风力基准', min: -100, max: 100, step: 5 },
  { path: 'SNOW.WIND_AMPLITUDE', label: '风力幅度（阵风）', min: 0, max: 120, step: 5 },
  { path: 'SNOW.WIND_PERIOD', label: '阵风周期（秒）', min: 1, max: 20, step: 0.5 },
  { path: 'SNOW.LIFE_MIN', label: '寿命（短）', min: 0.5, max: 10, step: 0.5 },
  { path: 'SNOW.LIFE_MAX', label: '寿命（长）', min: 1, max: 20, step: 0.5 },
  { path: 'SNOW.FADE_IN', label: '淡入时长', min: 0, max: 3, step: 0.1 },
  { path: 'SNOW.FADE_OUT', label: '淡出时长', min: 0, max: 3, step: 0.1 },
  { path: 'SNOW.SHAPE_SCALE', label: '雪花大小', min: 1, max: 4, step: 1 },
  { path: 'SNOW.BRIGHT_MIN', label: '雪花最暗亮度', min: 0.95, max: 1, step: 0.005 },
  { path: 'SNOW.FLICKER', label: '亮度闪烁幅度', min: 0, max: 1, step: 0.05 },
  { path: 'SNOW.FLICKER_SPEED', label: '闪烁速度（次/秒）', min: 0, max: 10, step: 0.5 },

  // 积雪
  { path: 'SNOW_COVER.GROUND_HEIGHT', label: '积雪高度（手动模式）', min: 0, max: 1, step: 0.02 },
  { path: 'SNOW_COVER.CHANGE_RATE', label: '堆积 / 消融速度', min: 0, max: 2, step: 0.05 },
  { path: 'SNOW_COVER.GROUND_JITTER', label: '雪线抖动', min: 0, max: 60, step: 2 },
  { path: 'SNOW_COVER.OBJECT_COVERAGE', label: '物体覆雪率', min: 0, max: 1, step: 0.05 },
];

// 按 "A.B.C" 这样的路径读值
function getByPath(path) {
  return path.split('.').reduce((obj, key) => obj[key], CONFIG);
}

// 按 "A.B.C" 这样的路径写值
function setByPath(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((obj, key) => obj[key], CONFIG)[last] = value;
}

function setupPanel() {
  const panel = document.getElementById('panel');
  if (!panel) return;

  const title = document.createElement('h2');
  title.textContent = '雪天参数';
  panel.appendChild(title);

  // 天气读数：由 main.js 每帧调用 updatePanelReadout 刷新
  const readout = document.createElement('div');
  readout.className = 'readout';
  readout.id = 'weatherReadout';
  readout.textContent = '天气：—';
  panel.appendChild(readout);

  for (const item of PANEL_ITEMS) {
    const row = document.createElement('div');
    row.className = item.type === 'toggle' ? 'row row-toggle' : 'row';

    const head = document.createElement('div');
    head.className = 'row-head';

    const label = document.createElement('span');
    label.textContent = item.label;

    const value = document.createElement('span');
    value.textContent = getByPath(item.path);

    head.appendChild(label);
    head.appendChild(value);

    // 开关型参数：只有开 / 关两个状态，用复选框
    if (item.type === 'toggle') {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = Boolean(getByPath(item.path));
      box.addEventListener('change', () => {
        setByPath(item.path, box.checked);
        value.textContent = box.checked;
      });
      row.appendChild(head);
      row.appendChild(box);
      panel.appendChild(row);
      continue;
    }

    // 数值型参数：滑块
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = item.min;
    slider.max = item.max;
    slider.step = item.step;
    slider.value = getByPath(item.path);

    slider.addEventListener('input', () => {
      const v = Number(slider.value);
      setByPath(item.path, v);
      value.textContent = v;
    });

    row.appendChild(head);
    row.appendChild(slider);
    panel.appendChild(row);
  }
}

// 每帧刷新天气读数（阶段 + 当前强度）
function updatePanelReadout(weather, intensity) {
  const el = document.getElementById('weatherReadout');
  if (!el) return;
  el.textContent = `天气：${weather.phase} · 强度 ${(intensity * 100).toFixed(0)}%`;
}

setupPanel();