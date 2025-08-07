import streamlit as st
from exposure_ui import exposure_ui  # ✅ this line imports the function

st.set_page_config(page_title="Exposure Calculator", layout="centered")

exposure_ui()  # ✅ call the function now that it's imported
