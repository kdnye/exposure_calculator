import streamlit as st
import math
from datetime import datetime
from exposure_logic import (
    calculate_ev,
    convert_iso,
    ev_to_shutter,
    ev_to_aperture,
    sunny_16_settings,
    zone_shift,
)

def exposure_ui():
    st.set_page_config("Film Exposure Calculator", layout="centered")
    st.title("\U0001F4F8 Film Exposure Calculator")

    mode = st.radio("Select Tool", ["Manual Exposure", "Sunny 16 Guide", "ISO Conversion", "Zone System", "Converter"])

    if mode == "Manual Exposure":
        # ... unchanged code for manual exposure ...
        pass

    elif mode == "Sunny 16 Guide":
        # ... unchanged code for sunny 16 ...
        pass

    elif mode == "ISO Conversion":
        # ... unchanged code for ISO conversion ...
        pass

    elif mode == "Zone System":
        st.markdown("### Zone System Visualizer")
        st.markdown("Use the slider below to shift exposure zones across EV values.")

        st.markdown("#### Exposure Settings")
        iso = st.number_input("Film ISO", min_value=1, max_value=3200, value=100)
        locked_field = st.radio("Lock one field", ["Aperture", "Shutter"], horizontal=True)

        if locked_field == "Aperture":
            aperture = st.number_input("Set Aperture (f/stop)", min_value=1.0, max_value=64.0, value=8.0)
            ev = st.slider("Set Zone V EV", min_value=0.0, max_value=20.0, value=10.0, step=0.1)
            shutter = ev_to_shutter(ev, aperture)
        else:
            shutter = st.number_input("Set Shutter (1/sec)", min_value=0.25, max_value=8000.0, value=125.0)
            ev = st.slider("Set Zone V EV", min_value=0.0, max_value=20.0, value=10.0, step=0.1)
            aperture = ev_to_aperture(ev, shutter)

        st.success(f"Aperture: f/{aperture:.2f}")
        st.success(f"Shutter Speed: 1/{shutter:.0f} sec")
        st.info(f"Zone V corresponds to EV {ev:.1f} at ISO {iso}")

        zones = ["Zone 0", "Zone I", "Zone II", "Zone III", "Zone IV", "Zone V", "Zone VI", "Zone VII", "Zone VIII", "Zone IX", "Zone X"]
        ev_values = [ev - 5 + i for i in range(11)]
        zone_colors = [
            "#000000", "#1a1a1a", "#333333", "#4d4d4d", "#666666", "#808080",
            "#999999", "#b3b3b3", "#cccccc", "#e6e6e6", "#ffffff"
        ]

        st.markdown("#### Zone Mapping")
        for i in range(len(zones)):
            st.markdown(f"""
                <div style='display:flex; align-items:center; margin-bottom:6px;'>
                    <div style='width:100px; padding:4px; background-color:{zone_colors[i]}; color:{'white' if i < 6 else 'black'}; text-align:center;'>
                        {zones[i]}
                    </div>
                    <div style='width:100px; padding:4px; background-color:#000000; text-align:center;'>
                        EV {ev_values[i]:.1f}
                    </div>
                </div>
            """, unsafe_allow_html=True)

    elif mode == "Converter":
        st.markdown("### Exposure Converter")
        st.caption("Set a baseline on the left. Change **one** value on the right; the rest will auto-calc to keep the exposure consistent. Use the priority buttons to lock either aperture or shutter on the right.")

        left_col, right_col = st.columns(2)
        with left_col:
            st.subheader("Baseline (Left)")
            iso_l = st.number_input("ISO (Left)", min_value=1, max_value=12800, value=100, key="iso_l")
            aperture_l = st.number_input("Aperture f/ (Left)", min_value=1.0, max_value=64.0, value=8.0, step=0.1, key="ap_l")
            shutter_l = st.number_input("Shutter 1/(Left)", min_value=0.25, max_value=8000.0, value=125.0, key="sh_l")
            ev_l = calculate_ev(aperture_l, shutter_l)
            st.info(f"Baseline EV: {ev_l:.2f} @ ISO {iso_l}")

        with right_col:
            st.subheader("Adjusted (Right)")
            priority = st.radio("Priority", ["Aperture Priority", "Shutter Priority"], horizontal=True, key="priority")
            iso_r = st.number_input("ISO (Right)", min_value=1, max_value=12800, value=400, key="iso_r")

            ev_r = convert_iso(ev_l, iso_l, iso_r)

            if priority == "Aperture Priority":
                aperture_r = st.number_input("Aperture f/ (Right)", min_value=1.0, max_value=64.0, value=aperture_l, step=0.1, key="ap_r")
                if st.button("Convert (Aperture Priority)"):
                    shutter_r = ev_to_shutter(ev_r, aperture_r)
                    st.success(f"Result → f/{aperture_r:.2f}, 1/{shutter_r:.0f}s @ ISO {iso_r} (EV {ev_r:.2f})")
            else:
                shutter_r = st.number_input("Shutter 1/(Right)", min_value=0.25, max_value=8000.0, value=shutter_l, key="sh_r")
                if st.button("Convert (Shutter Priority)"):
                    aperture_r = ev_to_aperture(ev_r, shutter_r)
                    st.success(f"Result → f/{aperture_r:.2f}, 1/{shutter_r:.0f}s @ ISO {iso_r} (EV {ev_r:.2f})")
