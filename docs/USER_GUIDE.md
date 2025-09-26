# Exposure Calculator – Help Guide

This guide summarises how to operate the calculator, persist settings, and build native packages. It distils the troubleshooting thread in `exposure too original gpt convo.txt` into concise steps.

## Using the Web App

### Global Adjustments
- **Filter Factor / Stops** – Enter either the filter multiplication factor or the equivalent stop value. The app keeps both in sync automatically.
- **Reciprocity Model** – Choose a preset film curve or select **Custom** to enter your own corrections at 1, 10, and 100 seconds. These adjustments reduce the effective EV used by all other calculators.

### Manual Solver
1. Enter ISO and any two of aperture (f-number), shutter time (seconds), or EV100.
2. Press **Solve** to compute the missing value and report EV at ISO 100 and the selected ISO.
3. If the inputs are ambiguous (e.g. all three fields filled), clear one and try again.

### Sunny 16 Guide
- Pick an ISO and lighting condition to get a suggested Sunny 16 exposure with reciprocity taken into account.

### ISO Conversion
- Enter the metered ISO, aperture, and shutter time.
- Enter the target ISO and press **Convert** to get the corrected shutter while holding the aperture constant.

### Zone System Slide Rule
1. Set ISO, then choose whether to lock aperture or shutter.
2. Drag the Zone V slider (or type an EV) to see the recalculated exposure and the EV for surrounding zones.
3. Adjust aperture/shutter fields manually to experiment with different locks.

### Two-up Converter
- Configure the left-hand baseline exposure and the right-hand target ISO.
- Choose **Aperture Priority** or **Shutter Priority** to decide which value stays fixed.
- Press **Convert** to get matching settings that preserve overall EV.

### Live Meter (Optional)
- Uncomment the `import './modules/live_meter.js'` line in `index.html` to reveal the card.
- Click **Start Meter** to access the camera. Point at an 18% gray target and press **Calibrate**.
- Toggle **Use Live EV Globally** to push measurements into the Zone System slider.

### Persistence
- The app automatically saves form values to `localStorage` after every change and restores them on the next visit.

## Progressive Web App
- The service worker (`sw.js`) caches assets for offline use. Install the app from your browser's "Add to Home screen" prompt for the best experience.

## Building for the Web
```bash
npm install
npm run build
```
The build command outputs bundled assets in `dist/`. The HTML imports scripts as ES modules so Vite can bundle them without the warnings mentioned in the earlier chat transcript.

## Android Packaging (Capacitor)
1. Build the web assets: `npm run build`.
2. Copy them into the native project: `npx cap sync android`.
3. Open Android Studio: `npx cap open android`, or build on the command line with `cd android && ./gradlew assembleDebug`.
4. The debug APK is produced at `android/app/build/outputs/apk/debug/app-debug.apk`.
5. If `adb` is missing in PowerShell, set `ANDROID_SDK_ROOT` and extend your `PATH` as highlighted in the transcript before installing the APK.

## Troubleshooting
- If the calculator UI loads but does not respond, confirm you are running the latest build (clear the app cache on Android via `adb shell pm clear com.fsi.exposure`).
- Use Chrome's **Remote Devices** panel (`chrome://inspect/#devices`) to view console errors from the Android WebView.
- Reciprocity corrections only apply when the shutter time is longer than one second; shorter exposures will show zero compensation.

