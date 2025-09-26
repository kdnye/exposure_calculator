/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const template = `
  <div id="app">
    <input id="ff_factor" value="1" />
    <input id="ff_stops" value="0" />
    <select id="rec_model"><option value="none">None</option></select>
    <input id="rec_c1" value="0" />
    <input id="rec_c10" value="0" />
    <input id="rec_c100" value="0" />

    <section id="manual">
      <input id="iso" value="200" />
      <input id="ap" value="8" />
      <input id="tv" value="0.125" />
      <input id="ev" value="" />
      <pre id="manualOut"></pre>
      <button id="solveManual"></button>
    </section>

    <section id="sunny16">
      <input id="s16_iso" value="100" />
      <select id="s16_cond"><option>Bright Sun</option></select>
      <button id="s16_calc"></button>
      <pre id="s16Out"></pre>
    </section>

    <section id="iso-convert">
      <input id="conv_iso_a" value="100" />
      <input id="conv_ap" value="8" />
      <input id="conv_tv" value="0.01" />
      <input id="conv_iso_b" value="400" />
      <button id="conv_calc"></button>
      <pre id="convOut"></pre>
    </section>

    <section id="zone">
      <input id="zone_iso" value="100" />
      <select id="zone_lock"><option value="ap">ap</option><option value="tv">tv</option></select>
      <input id="zone_ap" value="8" />
      <input id="zone_tv" value="0.01" />
      <input id="zone_ev_number" value="12" />
      <input id="zone_ev" value="12" />
      <div id="zonebar">
        <div id="zonebarTrack">
          <div id="zoneThumb"></div>
        </div>
        <div id="zonebarEVs"></div>
      </div>
      <pre id="zoneOut"></pre>
    </section>

    <section id="converter">
      <input id="left_iso" value="100" />
      <input id="left_ap" value="8" />
      <input id="left_tv" value="0.01" />
      <input id="right_iso" value="400" />
      <input id="right_ap" value="8" />
      <input id="right_tv" value="0.02" />
      <button id="btn_ap_pri"></button>
      <button id="btn_tv_pri"></button>
      <button id="convert"></button>
      <pre id="conv2Out"></pre>
    </section>
  </div>
`;

function createMockStorage() {
  const store = {};
  return {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    key: vi.fn((index) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
    _store: store,
  };
}

const STORE_KEY = 'exposure-pwa-state-v1';

describe('manual solve persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = template;

    const rect = () => ({
      width: 200,
      height: 40,
      top: 0,
      left: 0,
      right: 200,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    });
    const track = document.getElementById('zonebarTrack');
    const thumb = document.getElementById('zoneThumb');
    if (track) track.getBoundingClientRect = rect;
    if (thumb) thumb.getBoundingClientRect = rect;

    const storage = createMockStorage();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });

    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: vi.fn(() => Promise.resolve()),
      },
    });
  });

  it('persists solved EV into localStorage', async () => {
    const { solveManual } = await import('../app.js');
    const storage = window.localStorage;

    // clear initial hydration writes from module init
    storage.clear();

    const iso = document.getElementById('iso');
    const ap = document.getElementById('ap');
    const tv = document.getElementById('tv');
    const ev = document.getElementById('ev');

    iso.value = '200';
    ap.value = '8';
    tv.value = '0.125';
    ev.value = '';

    solveManual();

    const saved = storage.getItem(STORE_KEY);
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved);
    expect(parsed.ev).toBeCloseTo(9, 5);
  });
});
