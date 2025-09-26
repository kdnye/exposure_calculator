/**
 * Optional Live Meter card – exposes a simple reflected-light meter using the device camera.
 *
 * Include this script as a module (see index.html comment) to enable the UI card.
 */
const card = document.getElementById('liveMeterCard');
if (card) card.hidden = false;

const meter = {
  stream: null, raf: null, ctx: null,
  yCal: null, evCal: 10.0, emaY: null, alpha: 0.2
};

const log2 = (value) => (Math.log2 ? Math.log2(value) : Math.log(value) / Math.LN2);

/** Acquire the rear camera and start sampling frames into a canvas. */
async function startMeter(){
  try {
    meter.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    const v = document.getElementById('meter_video');
    v.srcObject = meter.stream;
    const c = document.getElementById('meter_canvas');
    meter.ctx = c.getContext('2d', { willReadFrequently: true });
    tickMeter();
  } catch (e) { alert('Camera error: ' + e.message); }
}
/** Tear down camera + animation frame resources. */
function stopMeter(){
  cancelAnimationFrame(meter.raf); meter.raf = null;
  if (meter.stream){ meter.stream.getTracks().forEach(t => t.stop()); meter.stream = null; }
}
/** Store the calibration luminance and EV reference (Zone V). */
function calibrateMeter(){
  meter.evCal = parseFloat(document.getElementById('meter_ev_cal').value) || 10.0;
  const y = currentLuma(); if (y){ meter.yCal = y; meter.emaY = y; }
}
/**
 * Sample the current frame and return average luminance (0–255).
 * Uses Rec. 709 weights which align with the Web platform.
 */
function currentLuma(){
  const v = document.getElementById('meter_video');
  const c = document.getElementById('meter_canvas');
  if (!meter.ctx || v.readyState < 2) return null;
  const { width, height } = c;
  meter.ctx.drawImage(v, 0, 0, width, height);
  const data = meter.ctx.getImageData(0, 0, width, height).data;
  let sumY = 0;
  for (let i=0; i<data.length; i+=4){
    const r=data[i], g=data[i+1], b=data[i+2];
    const y = 0.2126*r + 0.7152*g + 0.0722*b;
    sumY += y;
  }
  return sumY / (data.length/4);
}
/**
 * Animation loop – smooth luminance via EMA, convert to EV, optionally push to global UI.
 */
function tickMeter(){
  const y = currentLuma();
  if (y){
    meter.emaY = meter.emaY==null ? y : (meter.alpha*y + (1-meter.alpha)*meter.emaY);
    if (meter.yCal && meter.yCal > 0){
      const ev100Live = meter.evCal + log2(Math.max(1e-6, meter.emaY / meter.yCal));
      document.getElementById('meter_ev100').textContent = ev100Live.toFixed(2);
      const iso = window.readISO ? window.readISO() : 100;
      const evISO = ev100Live + log2(iso/100);
      document.getElementById('meter_ev_iso').textContent = evISO.toFixed(2);
      const useGlobal = document.getElementById('meter_use_global').checked;
      if (useGlobal && window.setGlobalEV100) window.setGlobalEV100(ev100Live);
    } else {
      document.getElementById('meter_ev100').textContent = 'Calibrate…';
      document.getElementById('meter_ev_iso').textContent = 'Calibrate…';
    }
  }
  meter.raf = requestAnimationFrame(tickMeter);
}
document.getElementById('meter_start').addEventListener('click', startMeter);
document.getElementById('meter_stop').addEventListener('click', stopMeter);
document.getElementById('meter_calib').addEventListener('click', calibrateMeter);
