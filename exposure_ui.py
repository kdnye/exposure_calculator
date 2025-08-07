import streamlit as st
from exposure_logic import (
    calculate_ev,
    convert_iso,
    ev_to_shutter,
    ev_to_aperture,
    sunny_16_settings,
)


def exposure_ui():
    st.set_page_config("Film Exposure Calculator", layout="centered")
    st.title("📸 Film Exposure Calculator")

    mode = st.radio(
        "Select Tool",
        ["Manual Exposure", "Sunny 16 Guide", "ISO Conversion", "Zone System", "Converter"],
        key="mode_picker",
    )

    # --- Manual Exposure ---
    if mode == "Manual Exposure":
        st.markdown("**Input any two values to calculate the others:**")
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            use_ev = st.checkbox("Input EV?", key="me_use_ev")
            ev_val = (
                st.number_input(
                    "EV", min_value=0.0, value=10.0, step=0.1, format="%0.2f", key="me_ev"
                )
                if use_ev
                else None
            )
        with col2:
            use_ap = st.checkbox("Input Aperture?", key="me_use_ap")
            ap_val = (
                st.number_input(
                    "Aperture (f/stop)",
                    min_value=1.0,
                    max_value=64.0,
                    value=8.0,
                    step=0.1,
                    key="me_ap",
                )
                if use_ap
                else None
            )
        with col3:
            use_sh = st.checkbox("Input Shutter?", key="me_use_sh")
            sh_val = (
                st.number_input(
                    "Shutter Speed (1/sec)",
                    min_value=0.25,
                    max_value=8000.0,
                    value=125.0,
                    key="me_sh",
                )
                if use_sh
                else None
            )
        with col4:
            use_iso = st.checkbox("Input ISO?", key="me_use_iso")
            iso_val = (
                st.number_input("ISO", min_value=1, max_value=12800, value=100, key="me_iso")
                if use_iso
                else None
            )

        if st.button("Calculate Missing Values", key="me_calc"):
            try:
                results = {}
                if ev_val is not None and ap_val is not None:
                    results["Shutter"] = ev_to_shutter(ev_val, ap_val)
                if ev_val is not None and sh_val is not None:
                    results["Aperture"] = ev_to_aperture(ev_val, sh_val)
                if ap_val is not None and sh_val is not None:
                    results["EV"] = calculate_ev(ap_val, sh_val)
                if iso_val is not None:
                    results["ISO"] = iso_val

                if not results:
                    st.warning("Please enter at least two values.")
                else:
                    for k, v in results.items():
                        if k == "Shutter":
                            st.success(f"Calculated Shutter: 1/{v:.0f}s")
                        elif k == "Aperture":
                            st.success(f"Calculated Aperture: f/{v:.2f}")
                        elif k == "EV":
                            st.success(f"Calculated EV: {v:.2f}")
                        elif k == "ISO":
                            st.info(f"ISO: {v}")
            except Exception as e:
                st.error(f"Calculation error: {e}")

    # --- Sunny 16 ---
    elif mode == "Sunny 16 Guide":
        iso = st.number_input("ISO", min_value=1, max_value=12800, value=100, key="s16_iso")
        condition = st.selectbox(
            "Lighting Condition",
            ["Bright Sun", "Slight Overcast", "Overcast", "Heavy Overcast", "Open Shade/Sunset"],
            key="s16_cond",
        )
        if st.button("Suggest Settings", key="s16_btn"):
            f, sh = sunny_16_settings(iso, condition)
            st.success(f"Suggested: f/{f}, 1/{round(1/sh)}s @ ISO {iso}")

    # --- ISO Conversion ---
    elif mode == "ISO Conversion":
        from_iso = st.number_input("Metered ISO", min_value=1, max_value=12800, value=100, key="iso_from")
        to_iso = st.number_input("Target ISO", min_value=1, max_value=12800, value=400, key="iso_to")
        ap = st.number_input("Aperture (f/)", min_value=1.0, max_value=64.0, value=8.0, step=0.1, key="iso_ap")
        sh = st.number_input("Shutter (1/sec)", min_value=0.25, max_value=8000.0, value=125.0, key="iso_sh")
        if st.button("Convert", key="iso_btn"):
            try:
                ev0 = calculate_ev(ap, sh)
                ev1 = convert_iso(ev0, from_iso, to_iso)
                sh_new = ev_to_shutter(ev1, ap)
                st.success(f"Equivalent: f/{ap:.2f}, 1/{sh_new:.0f}s @ ISO {to_iso} (EV {ev1:.2f})")
            except Exception as e:
                st.error(f"Conversion error: {e}")

    # --- Zone System ---
    elif mode == "Zone System":
        st.markdown("### Zone System Visualizer")
        st.markdown("Set Zone V (middle gray) EV, lock either aperture or shutter, and the other value will follow.")

        iso = st.number_input("Film ISO", min_value=1, max_value=3200, value=100, key="zone_iso")
        locked_field = st.radio("Lock one field", ["Aperture", "Shutter"], horizontal=True, key="zone_lock")

        if locked_field == "Aperture":
            aperture = st.number_input("Set Aperture (f/stop)", min_value=1.0, max_value=64.0, value=8.0, key="zone_ap")
            ev = st.slider("Set Zone V EV", min_value=0.0, max_value=20.0, value=5.0, step=0.5, key="zone_ev")
            shutter = ev_to_shutter(ev, aperture)
        else:
            shutter = st.number_input("Set Shutter (1/sec)", min_value=0.25, max_value=8000.0, value=125.0, key="zone_sh")
            ev = st.slider("Set Zone V EV", min_value=0.0, max_value=20.0, value=5.0, step=0.5, key="zone_ev")
            aperture = ev_to_aperture(ev, shutter)

        st.success(f"Aperture: f/{aperture:.2f}")
        st.success(f"Shutter Speed: 1/{shutter:.0f} sec")
        st.info(f"Zone V corresponds to EV {ev:.1f} @ ISO {iso}")

        zones = [
            "Zone 0", "Zone I", "Zone II", "Zone III", "Zone IV",
            "Zone V", "Zone VI", "Zone VII", "Zone VIII", "Zone IX", "Zone X",
        ]
        ev_values = [ev - 5 + i for i in range(11)]
        zone_colors = [
            "#000000", "#1a1a1a", "#333333", "#4d4d4d", "#666666", "#808080",
            "#999999", "#b3b3b3", "#cccccc", "#e6e6e6", "#ffffff",
        ]

        st.markdown("#### Zone Mapping")
        for i in range(len(zones)):
            st.markdown(
                f"""
                <div style='display:flex; align-items:center; margin-bottom:6px;'>
                    <div style='width:120px; padding:6px; background-color:{zone_colors[i]}; color:{'white' if i < 6 else 'black'}; text-align:center;'>
                        {zones[i]}
                    </div>
                    <div style='width:120px; padding:6px; background-color:#f0f0f0; text-align:center;'>
                        EV {ev_values[i]:.1f}
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    # --- Converter ---
    elif mode == "Converter":
        st.markdown("### Exposure Converter")
        st.caption(
            "Set a baseline on the left. Change **one** value on the right; the rest will auto-calc to keep exposure constant. Use the priority buttons to lock either aperture or shutter on the right."
        )

        left_col, right_col = st.columns(2)
        with left_col:
            st.subheader("Baseline (Left)")
            iso_l = st.number_input("ISO (Left)", min_value=1, max_value=12800, value=100, key="iso_l")
            ap_l = st.number_input("Aperture f/ (Left)", min_value=1.0, max_value=64.0, value=8.0, step=0.1, key="ap_l")
            sh_l = st.number_input("Shutter 1/(Left)", min_value=0.25, max_value=8000.0, value=125.0, key="sh_l")
            ev_l = calculate_ev(ap_l, sh_l)
            st.info(f"Baseline EV: {ev_l:.2f} @ ISO {iso_l}")

        with right_col:
            st.subheader("Adjusted (Right)")
            priority = st.radio("Priority", ["Aperture Priority", "Shutter Priority"], horizontal=True, key="priority")
            iso_r = st.number_input("ISO (Right)", min_value=1, max_value=12800, value=400, key="iso_r")
            ev_r = convert_iso(ev_l, iso_l, iso_r)

            if priority == "Aperture Priority":
                ap_r = st.number_input("Aperture f/ (Right)", min_value=1.0, max_value=64.0, value=ap_l, step=0.1, key="ap_r")
                if st.button("Convert (Aperture Priority)", key="btn_apr"):
                    sh_r = ev_to_shutter(ev_r, ap_r)
                    st.success(f"Result → f/{ap_r:.2f}, 1/{sh_r:.0f}s @ ISO {iso_r} (EV {ev_r:.2f})")
            else:
                sh_r = st.number_input("Shutter 1/(Right)", min_value=0.25, max_value=8000.0, value=sh_l, key="sh_r")
                if st.button("Convert (Shutter Priority)", key="btn_shr"):
                    ap_r = ev_to_aperture(ev_r, sh_r)
                    st.success(f"Result → f/{ap_r:.2f}, 1/{sh_r:.0f}s @ ISO {iso_r} (EV {ev_r:.2f})")
