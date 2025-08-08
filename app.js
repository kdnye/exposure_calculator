// ---------- Core math ----------
// EV100 = log2(N^2 / t)  (ISO 100 reference)
// EV(ISO) = EV100 + log2(ISO/100)
// Solve helpers
const log2 = x => Math.log(x) / Math.log(2);

function ev100From(N, t) {
  return log2((N*N) / t);
}
function tvFrom(N, EV100) {
  // t = N^2 / 2^EV100
  return (N*N) / Math.pow(2, EV100);
}
function avFrom(t, EV100) {
  // N = sqrt( 2^EV100 * t )
  return Math.sqrt(Math.pow(2, EV100) * t);
}
function evISO(ev100, ISO) {
  return ev100 + log2(ISO/100);
}
function ev100FromISO(evISOval, ISO) {
  return evISOval - log2(ISO/100);
}

// Equivalent exposure between ISOs (same scene luminance)
function convertShutterForISO(N, t, isoA, isoB) {
  const evA100 = ev100From(N, t);
  const evAISO = evISO(evA100, isoA);
  const evB100 = ev100FromISO(evAISO, isoB);
  return tvFrom(N, evB100); // new t at isoB keeping same f
}

// Sunny 16 presets -> [f, t(s) @ ISO 100 baseline is 1/ISO at f/16]
const s16 = {
  "Bright Sun": { f: 16, shiftEV: 0 },
  "Hazy Sun": { f: 16, shiftEV: -1/2 },   // half stop darker
  "Open Shade": { f: 11, shiftEV: -1 },   // ~1 stop less light
  "Heavy Overcast": { f: 8, shiftEV: -2 },
  "Indoors (bright)": { f: 4, shiftEV: -4 }
};

const ZONE_COLORS = [
  "#000000", "#1b1b1b", "#303030", "#474747", "#5e5e5e", // 0-4
  "#7a7a7a", "#9a9a9a", "#bbbbbb", "#d9d9d9", "#f0f0f0", "#ffffff" // 5-10
];

// ---------- Manual: solve by two inputs ----------
function solveManual() {
  const ISO = num('#iso');
  const ap = val('#ap');
  const tv = val('#tv');
  const ev = val('#ev');

  let known = 0;
  if (!isNaN(ap)) known++;
  if (!isNaN(tv)) known++;
  if (!isNaN(ev)) known++;

  if (known < 2) return out('#manualOut', "Enter any two of: aperture, shutter, EV.");

  // Prioritize solving EV100 first if ap & tv provided
  if (!isNaN(ap) && !isNaN(tv)) {
    const EV100 = ev100From(ap, tv);
    const EVISO = evISO(EV100, ISO);
    out('#manualOut',
      `EV100=${EV100.toFixed(2)} | EV(ISO ${ISO})=${EVISO.toFixed(2)}\n` +
      `Keeps: f/${ap}, t=${tv}s`
    );
    setIfEmpty('#ev', EV100.toFixed(2));
    return;
  }

  // If EV and one of (ap or tv)
  if (!isNaN(ev)) {
    const EV100 = ev; // input is EV at ISO 100
    if (!isNaN(ap) && isNaN(tv)) {
      const t = tvFrom(ap, EV100);
      set('#tv', t);
      const EVISO = evISO(EV100, ISO);
      out('#manualOut', `Solved t=${fmtTime(t)} | EV(ISO ${ISO})=${EVISO.toFixed(2)}`);
      return;
    }
    if (isNaN(ap) && !isNaN(tv)) {
      const N = avFrom(tv, EV100);
      set('#ap', N);
      const EVISO = evISO(EV100, ISO);
      out('#manualOut', `Solved f/${N.toFixed(2)} | EV(ISO ${ISO})=${EVISO.toFixed(2)}`);
      return;
    }
  }

  out('#manualOut', "Ambiguous inputs — clear one field and try again.");
}

// ---------- Sunny 16 ----------
function sunny16() {
  const ISO = num('#s16_iso');
  const cond = document.querySelector('#s16_cond').value;
  const base = s16[cond] || s16["Bright Sun"];

  // Baseline: EV100 at f/16, t = 1/100 for ISO 100 ~ EV 15 (rule of thumb)
  // Better: start from 1/ISO at f/16; shiftEV tweaks around that baseline.
  const tBase = 1 / ISO;
  const evBase = ev100From(16, tBase) + base.shiftEV;

  // Suggest using the preset f; compute shutter
  const suggestedT = tvFrom(base.f, evBase);
  out('#s16Out', `Suggested: f/${base.f}, t≈${fmtTime(suggestedT)}  (EV100≈${evBase.toFixed(1)})`);
}

// ---------- ISO Conversion ----------
function isoConvert() {
  const isoA = num('#conv_iso_a');
  const isoB = num('#conv_iso_b');
  const ap = num('#conv_ap');
  const tv = num('#conv_tv');

  const t2 = convertShutterForISO(ap, tv, isoA, isoB);
  out('#convOut', `Keep f/${ap} → new shutter at ISO ${isoB}: ${fmtTime(t2)}`);
}

// ---------- Zone System ----------
function renderZones(ev5) {
  const container = document.querySelector('#zones');
  container.innerHTML = '';
  for (let z = 0; z <= 10; z++) {
    // Zone V is reference; each zone is 1 stop (EV) apart
    const evZ = ev5 + (z - 5);
    const div = document.createElement('div');
    div.className = 'zone';
    div.style.background = ZONE_COLORS[z];
    div.innerHTML = `<span>Zone ${z}</span><span>EV100 ${evZ.toFixed(1)}</span>`;
    container.appendChild(div);
  }
}

function zoneUpdate() {
  const ISO = num('#zone_iso');
  const lock = document.querySelector('#zone_lock').value;
  let ap = num('#zone_ap');
  let tv = num('#zone_tv');
  const ev5 = num('#zone_ev');

  // If locking aperture, compute shutter; else compute aperture
  if (lock === 'ap') {
    const t = tvFrom(ap, ev5);
    tv = t;
    set('#zone_tv', t);
  } else {
    const N = avFrom(tv, ev5);
    ap = N;
    set('#zone_ap', N);
  }

  renderZones(ev5);
  const EVISO = evISO(ev5, ISO);
  out('#zoneOut', `Zone V EV100=${ev5.toFixed(2)} | EV(ISO ${ISO})=${EVISO.toFixed(2)} | f/${ap.toFixed(2)} @ ${fmtTime(tv)}`);
}

// ---------- Converter (left → right) ----------
let mode = 'ap'; // 'ap' or 'tv'
document.querySelector('#btn_ap_pri').onclick = () => mode = 'ap';
document.querySelector('#btn_tv_pri').onclick = () => mode = 'tv';

function convertLeftRight() {
  const li = num('#left_iso'), la = num('#left_ap'), lt = num('#left_tv');
  const ri = num('#right_iso');
  let ra = num('#right_ap'), rt = num('#right_tv');

  const EVL100 = ev100From(la, lt);
  const EVLISO = evISO(EVL100, li);
  const EVR100 = ev100FromISO(EVLISO, ri);

  if (mode === 'ap') {
    // keep aperture on right, solve shutter
    const t = tvFrom(ra, EVR100);
    set('#right_tv', t);
    out('#conv2Out', `Right (Aperture Priority): f/${ra}, t=${fmtTime(t)} (same EV)`);
  } else {
    // keep shutter on right, solve aperture
    const N = avFrom(rt, EVR100);
    set('#right_ap', N);
    out('#conv2Out', `Right (Shutter Priority): f/${N.toFixed(2)}, t=${fmtTime(rt)} (same EV)`);
  }
}

// ---------- utilities ----------
function num(sel){ return parseFloat(document.querySelector(sel).value); }
function val(sel){ const v = document.querySelector(sel).value; const n = parseFloat(v); return isNaN(n)? NaN : n; }
function set(sel,v){ document.querySelector(sel).value = v; }
function setIfEmpty(sel,v){ const el=document.querySelector(sel); if(!el.value) el.value=v; }
function out(sel, msg){ document.querySelector(sel).textContent = msg; }
function fmtTime(t){
  if (t >= 1) return `${t.toFixed(3)}s`;
  const denom = Math.round(1/t);
  return `1/${denom}`;
}

// ---------- wire up ----------
document.querySelector('#solveManual').onclick = solveManual;
document.querySelector('#s16_calc').onclick = sunny16;
document.querySelector('#conv_calc').onclick = isoConvert;
document.querySelector('#zone_ev').oninput = zoneUpdate;
document.querySelector('#zone_lock').onchange = zoneUpdate;
document.querySelector('#zone_ap').oninput = zoneUpdate;
document.querySelector('#zone_tv').oninput = zoneUpdate;
document.querySelector('#convert').onclick = convertLeftRight;

// First render
renderZones(num('#zone_ev'));
zoneUpdate();

// PWA service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
