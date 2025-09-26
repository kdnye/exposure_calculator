# Exposure Calculator Architecture

This document captures the high-level structure of the Exposure Calculator PWA based on the development conversation in `exposure too original gpt convo.txt` and the current code layout.

## Overview

The application is a small offline-first single-page app that helps photographers translate between exposure parameters. It is built with plain HTML, CSS, and modern JavaScript, then bundled with [Vite](https://vitejs.dev/) for deployment and for wrapping into a Capacitor-powered Android shell.

The UI is composed of cards that correspond to functional modules:

- **Global Adjustments** – filter factors and reciprocity failure models that shift the effective EV before any other calculations happen.
- **Manual Solver** – accepts any two of aperture (`N`), shutter time (`t`), and EV100, then derives the missing variable and EV at the selected ISO.
- **Sunny 16 Guide** – presets around the Sunny 16 rule that provide a quick suggestion for outdoor lighting conditions.
- **ISO Conversion** – keeps aperture fixed while converting a metered shutter speed to a target ISO.
- **Zone System Slide Rule** – draggable slider for visualising Zone V adjustments while locking aperture or shutter.
- **Two-up Converter** – maintains EV across two exposure setups with ISO, aperture, or shutter priority.
- **Live Meter (optional)** – experimental card that turns the device camera into a reflected-light meter and can push the measured EV back into the rest of the UI.

## Runtime Modules

| File | Purpose |
| --- | --- |
| `index.html` | Static scaffold for the PWA. Loads all scripts as ES modules so Vite can bundle them. |
| `app.js` | Main application logic. Defines EV helper math, card controllers, state persistence, and event wiring. |
| `storage.js` | Placeholder for future storage abstractions. Currently empty but imported to keep module boundaries stable. |
| `modules/live_meter.js` | Optional camera-based meter. Exported through side effects when the script is imported. |
| `sw.js` | Service worker that enables offline capability. |

`app.js` exports only two functions globally (`window.readISO` and `window.setGlobalEV100`) that are used by the live meter to integrate with the rest of the calculator. Everything else is encapsulated in module scope.

## Data Flow

1. **User inputs** are read via helper utilities (`num`, `val`, etc.).
2. The calculator converts between exposure values using logarithmic relationships documented at the top of `app.js`.
3. Global adjustments are applied by subtracting filter and reciprocity stops from the computed EV before solving for aperture or shutter.
4. Results are written back to the DOM via `set`, `setIfEmpty`, and `out` helpers.
5. Every change triggers `saveState`, which persists a JSON snapshot in `localStorage` under `exposure-pwa-state-v1`.
6. On load, `loadState` rehydrates the UI and `initZoneBar` wires pointer events for the Zone System slider.

## Bundling and Capacitor Integration

- Vite expects browser scripts to be ES modules. The HTML now uses a `<script type="module">` wrapper to import `app.js` and optional modules. This eliminates the "can't be bundled without type=\"module\"" warnings noted in the original conversation.
- `npm run build` produces `dist/` assets that Capacitor copies into the Android project with `npx cap sync android`.
- The Android shell lives under `android/` and is managed with Gradle (`./gradlew assembleDebug`) as outlined in the chat transcript.

## Reciprocity Models

`app.js` implements piecewise logarithmic interpolation between the sample points used in classic reciprocity correction tables. The custom model allows the user to override the curve at 1, 10, and 100 seconds.

## Extending the App

- **New cards**: add HTML markup in `index.html`, style in `styles.css`, and a controller function in `app.js`.
- **Additional persistence**: move the inline storage helpers into `storage.js` once more structure (namespaces, migrations) is required.
- **Live Meter**: enable by uncommenting the import in `index.html`; the module handles showing the card and wiring controls automatically.

## Known Limitations

- The live meter relies on `getUserMedia`, so it is limited to HTTPS contexts or localhost.
- Reciprocity curves assume exposures up to ~1000 seconds; extremely long exposures may need additional sample points.
- All calculations are in floating-point; rounding is applied only for display.

