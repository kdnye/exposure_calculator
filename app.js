// ===== Core math =====
const log2 = x => Math.log(x)/Math.log(2);

// EV100 = log2(N^2 / t)
function ev100From(N, t){ return log2((N*N)/t); }
// t = N^2 / 2^EV100
function tvFrom(N, EV100){ return (N*N)/Math.pow(2, EV100); }
// N = sqrt(2^EV100 * t)
function avFrom(t, EV100){ return Math.sqrt(Math.pow(2, EV100) * t); }
function evISO(ev100, ISO){ return ev100 + log2(ISO/100); }
function ev100FromISO(evISOval, ISO){ return evISOval - log2(ISO/100); }

// Sunny 16 presets (approx)
const s16 = {
  "Bright Sun": { f: 16, shiftEV: 0 },
  "Hazy Sun": { f: 16, shiftEV: -0.5 },
  "Open Shade": { f: 11, shiftEV: -1 },
  "Heavy Overcast": { f: 8, shiftEV: -2 },
  "Indoors (bright)": { f: 4, shiftEV: -4 }
};

// ===== Global Adjustments (Filter & Reciprocity) =====
function filterStops() {
  const ff = parseFloat($('#ff_factor').value) || 1;
  const fs = parseFloat($('#ff_stops').value);
  const calcStops = Math.log2(Math.max(1, ff));
  const finalStops = isNaN(fs) ? calcStops : fs;
  $('#ff_stops').value = finalStops.toFixed(2);
  $('#ff_factor').value = Math.max(1, Math.pow(2, finalStops)).toFixed(2);
  return finalStops;
}

function reciprocityStops(t) {
  const model = $('#rec_model').value;
  if (model === 'none' || !isFinite(t) || t <= 0) return 0;
  const log10 = x => Math.log10(x);
  let p1=0, p10=0, p100=0;
  if (model === 'generic') { p1=0.5; p10=1.5; p100=3.0; }
  else if (model === 'hp5' || model === 'trix') { p1=1.0; p10=2.0; p100=3.5; }
  else if (model === 'acros2'){ p1=0.0; p10=0.3; p100=0.5; }
  else if (model === 'custom') {
    p1 = parseFloat($('#rec_c1').value)   || 0;
    p10 = parseFloat($('#rec_c10').value) || p1;
    p100 = parseFloat($('#rec_c100').value)|| p10;
  }
  const tsec = t;
  if (tsec <= 1) return 0;
  if (tsec >= 10) {
    const m = (p100 - p10) / (log10(100)-log10(10));
    return p10 + m*(log10(Math.min(tsec, 1000)) - log10(10));
  } else {
    const m = (p10 - p1) / (log10(10)-log10(1));
    return p1 + m*(log10(tsec) - log10(1));
  }
}

function applyGlobalStopsToEV(ev100, tSecondsForRecip) {
  const fStops = filterStops();
  const rStops = reciprocityStops(Math.max(tSecondsForRecip, 1e-6));
  return ev100 - (fStops + rStops);
}

// Iterative shutter solve including reciprocity
function tvFromGlobal(N, ev100, maxIter=15, tol=1e-4) {
  let t = tvFrom(N, ev100);
  for (let i=0; i<maxIter; i++) {
    const evEff = applyGlobalStopsToEV(ev100, t);
    const tNew = tvFrom(N, evEff);
    if (Math.abs(tNew - t) < tol) return tNew;
    t = tNew;
  }
  return t;
}

// Aperture solve including reciprocity (uses given t)
function avFromGlobal(t, ev100) {
  const evEff = applyGlobalStopsToEV(ev100, t);
  return avFrom(t, evEff);
}

// ===== Utilities =====
function $(sel){ return document.querySelector(sel); }
function num(sel){ return parseFloat($(sel).value); }
function val(sel){ const v = $(sel).value; const n = parseFloat(v); return isNaN(n)? NaN : n; }
function set(sel,v){ $(sel).value = v; }
function setIfEmpty(sel,v){ const el=$(sel); if(!el.value) el.value=v; }
function out(sel, msg){ $(sel).textContent = msg; }
function fmtTime(t){ if (t >= 1) return `${t.toFixed(3)}s`; const d = Math.round(1/t); return `1/${d}`; }

// ===== Local storage helpers (simple persist/load) =====
const STORE_KEY = 'exposure-pwa-state-v1';
function saveState() {
  const state = {
    iso: num('#iso'), ap: num('#ap'), tv: num('#tv'), ev: val('#ev'),
    ff_factor: num('#ff_factor'), ff_stops: num('#ff_stops'), rec_model: $('#rec_model').value,
    rec_c1: num('#rec_c1'), rec_c10: num('#rec_c10'), rec_c100: num('#rec_c100'),
    zone_iso: num('#zone_iso'), zone_lock: $('#zone_lock').value, zone_ap: num('#zone_ap'), zone_tv: num('#zone_tv'),
    zone_ev: num('#zone_ev'), left_iso: num('#left_iso'), left_ap: num('#left_ap'), left_tv: num('#left_tv'),
    right_iso: num('#right_iso'), right_ap: num('#right_ap'), right_tv: num('#right_tv'),
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const put = (id, v) => { if (v !== undefined && !Number.isNaN(v) && $(id)) $(id).value = v; };
    put('#iso', s.iso); put('#ap', s.ap); put('#tv', s.tv); put('#ev', s.ev);
    put('#ff_factor', s.ff_factor); put('#ff_stops', s.ff_stops);
    if (s.rec_model) $('#rec_model').value = s.rec_model;
    put('#rec_c1', s.rec_c1); put('#rec_c10', s.rec_c10); put('#rec_c100', s.rec_c100);
    put('#zone_iso', s.zone_iso); if (s.zone_lock) $('#zone_lock').value = s.zone_lock;
    put('#zone_ap', s.zone_ap); put('#zone_tv', s.zone_tv); put('#zone_ev', s.zone_ev);
    put('#left_iso', s.left_iso); put('#left_ap', s.left_ap); put('#left_tv', s.left_tv);
    put('#right_iso', s.right_iso); put('#right_ap', s.right_ap); put('#right_tv', s.right_tv);
  } catch {}
}

// ===== Manual =====
function solveManual() {
  const ISO = num('#iso');
  const ap = val('#ap');
  const tv = val('#tv');
  const ev = val('#ev');

  let known = 0;
  if (!isNaN(ap)) known++;
  if (!isNaN(tv)) known++;
  if (!isNaN(ev)) known++;
  if (known < 2) return out('#manualOut', "Enter any two of: aperture, shutter, EV100.");

  if (!isNaN(ap) && !isNaN(tv)) {
    const EV100 = ev100From(ap, tv);
    const EVISO = evISO(EV100, ISO);
    out('#manualOut', `EV100=${EV100.toFixed(2)} | EV(ISO ${ISO})=${EVISO.toFixed(2)}\nKeeps: f/${ap}, t=${fmtTime(tv)}`);
    setIfEmpty('#ev', EV100.toFixed(2));
    return;
  }

  if (!isNaN(ev)) {
    const EV100 = ev;
    if (!isNaN(ap) && isNaN(tv)) {
      const t = tvFromGlobal(ap, EV100);
      set('#tv', t);
      const EVISO = evISO(EV100, ISO);
      out('#manualOut', `Solved t=${fmtTime(t)} | EV(ISO ${ISO})=${EVISO.toFixed(2)}`);
      return;
    }
    if (isNaN(ap) && !isNaN(tv)) {
      const N = avFromGlobal(tv, EV100);
      set('#ap', N);
      const EVISO = evISO(EV100, ISO);
      out('#manualOut', `Solved f/${N.toFixed(2)} | EV(ISO ${ISO})=${EVISO.toFixed(2)}`);
      return;
    }
  }

  out('#manualOut', "Ambiguous inputs — clear one field and try again.");
  saveState();
}

// ===== Sunny 16 =====
function sunny16() {
  const ISO = num('#s16_iso');
  const cond = $('#s16_cond').value;
  const base = s16[cond] || s16["Bright Sun"];
  const tBase = 1 / ISO;
  const evBase = ev100From(16, tBase) + base.shiftEV;
  const suggestedT = tvFromGlobal(base.f, evBase);
  out('#s16Out', `Suggested: f/${base.f}, t≈${fmtTime(suggestedT)}  (EV100≈${evBase.toFixed(1)})`);
  saveState();
}

// ===== ISO Conversion =====
function convertShutterForISO(N, t, isoA, isoB) {
  const evA100 = ev100From(N, t);
  const evAISO = evISO(evA100, isoA);
  const evB100 = ev100FromISO(evAISO, isoB);
  return tvFromGlobal(N, evB100);
}
function isoConvert() {
  const isoA = num('#conv_iso_a');
  const isoB = num('#conv_iso_b');
  const ap = num('#conv_ap');
  const tv = num('#conv_tv');
  const t2 = convertShutterForISO(ap, tv, isoA, isoB);
  out('#convOut', `Keep f/${ap} → new shutter at ISO ${isoB}: ${fmtTime(t2)}`);
  saveState();
}

// ===== Zone System (draggable Zone V) =====
const ZONE_MIN = 3, ZONE_MAX = 18;
const zoneThumb = $('#zoneThumb');
const zoneTrack = $('#zonebarTrack');
const zoneEVs = $('#zonebarEVs');
const zoneRange = $('#zone_ev');
const zoneNumber = $('#zone_ev_number');

function valueToPx(el, val, min, max) {
  const rect = el.getBoundingClientRect(); const w = rect.width;
  const t = (val - min)/(max - min); return t*w;
}
function pxToValue(el, px, min, max) {
  const rect = el.getBoundingClientRect(); const w = rect.width;
  let t = px / Math.max(1, w); t = Math.min(1, Math.max(0, t));
  return min + t*(max - min);
}

function renderZones(ev5) {
  zoneEVs.innerHTML = '';
  for (let z=0; z<=10; z++) {
    const evZ = ev5 + (z - 5);
    const div = document.createElement('div');
    div.textContent = `EV ${evZ.toFixed(1)}`;
    zoneEVs.appendChild(div);
  }
  const px = valueToPx(zoneTrack, ev5, ZONE_MIN, ZONE_MAX);
  zoneThumb.style.left = `${px}px`;
}

function applyZoneExposure(ev5) {
  const ISO = num('#zone_iso');
  const lock = $('#zone_lock').value;
  let ap = num('#zone_ap');
  let tv = num('#zone_tv');

  if (lock === 'ap') {
    const t = tvFromGlobal(ap, ev5);
    tv = t; set('#zone_tv', t);
  } else {
    const N = avFromGlobal(tv, ev5);
    ap = N; set('#zone_ap', N);
  }

  const EVISO = evISO(ev5, ISO);
  out('#zoneOut', `Zone V → EV100=${ev5.toFixed(2)} | EV(ISO ${ISO})=${EVISO.toFixed(2)} | f/${ap.toFixed(2)} @ ${fmtTime(tv)}`);
  renderZones(ev5);
  saveState();
}

function syncEVInputs(ev5) {
  zoneRange.value = ev5;
  zoneNumber.value = ev5.toFixed(1);
}
function initZoneBar() {
  const startEV = parseFloat(zoneRange.value) || 12;
  syncEVInputs(startEV);
  renderZones(startEV);
  applyZoneExposure(startEV);

  zoneNumber.oninput = () => {
    let v = parseFloat(zoneNumber.value); if (isNaN(v)) return;
    v = Math.max(ZONE_MIN, Math.min(ZONE_MAX, v));
    syncEVInputs(v); applyZoneExposure(v);
  };
  zoneRange.oninput = () => {
    const v = parseFloat(zoneRange.value);
    syncEVInputs(v); applyZoneExposure(v);
  };

  $('#zone_lock').onchange = () => applyZoneExposure(num('#zone_ev'));
  $('#zone_ap').oninput = () => applyZoneExposure(num('#zone_ev'));
  $('#zone_tv').oninput = () => applyZoneExposure(num('#zone_ev'));
  $('#zone_iso').oninput = () => applyZoneExposure(num('#zone_ev'));

  let dragging = false;
  const onPointerDown = (e) => { dragging = true; zoneThumb.setPointerCapture?.(e.pointerId); };
  const onPointerMove = (e) => {
    if (!dragging) return;
    const rect = zoneTrack.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ev5 = pxToValue(zoneTrack, x, ZONE_MIN, ZONE_MAX);
    syncEVInputs(ev5); applyZoneExposure(ev5);
  };
  const onPointerUp = () => { dragging = false; };

  zoneThumb.addEventListener('pointerdown', onPointerDown);
  zoneTrack.addEventListener('pointerdown', (e) => {
    const rect = zoneTrack.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ev5 = pxToValue(zoneTrack, x, ZONE_MIN, ZONE_MAX);
    syncEVInputs(ev5); applyZoneExposure(ev5);
  });
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

// ===== Converter (left → right) =====
let mode = 'ap';
$('#btn_ap_pri').onclick = () => { mode = 'ap'; saveState(); };
$('#btn_tv_pri').onclick = () => { mode = 'tv'; saveState(); };

function convertLeftRight() {
  const li = num('#left_iso'), la = num('#left_ap'), lt = num('#left_tv');
  const ri = num('#right_iso');
  let ra = num('#right_ap'), rt = num('#right_tv');

  const EVL100 = ev100From(la, lt);
  const EVLISO = evISO(EVL100, li);
  const EVR100 = ev100FromISO(EVLISO, ri);

  if (mode === 'ap') {
    const t = tvFromGlobal(ra, EVR100);
    set('#right_tv', t);
    out('#conv2Out', `Right (Aperture Priority): f/${ra}, t=${fmtTime(t)} (same EV)`);
  } else {
    const N = avFromGlobal(rt, EVR100);
    set('#right_ap', N);
    out('#conv2Out', `Right (Shutter Priority): f/${N.toFixed(2)}, t=${fmtTime(rt)} (same EV)`);
  }
  saveState();
}

// ===== ISO for live meter helper =====
window.readISO = function readISO(){
  const isoNode = document.querySelector('#iso, #zone_iso, #left_iso') || { value: '100' };
  return parseFloat(isoNode.value) || 100;
};
// Global EV injection (used by live meter module if enabled)
window.setGlobalEV100 = function setGlobalEV100(ev){
  // Set Zone V EV slider/number and recalc
  syncEVInputs(ev);
  applyZoneExposure(ev);
};

// ===== Wire up =====
loadState();
document.querySelectorAll('input,select').forEach(el => el.addEventListener('change', saveState));
$('#solveManual').onclick = solveManual;
$('#s16_calc').onclick = sunny16;
$('#conv_calc').onclick = isoConvert;
$('#convert').onclick = convertLeftRight;
initZoneBar();

// ===== PWA service worker =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
