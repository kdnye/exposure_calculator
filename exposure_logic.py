import math

def calculate_ev(aperture: float, shutter_speed: float) -> float:
    """Compute Exposure Value (EV) from aperture and shutter speed."""
    return math.log2((aperture ** 2) / (1 / shutter_speed))

def convert_iso(ev: float, from_iso: int, to_iso: int) -> float:
    """Adjust EV for a new ISO."""
    delta_ev = math.log2(to_iso / from_iso)
    return ev + delta_ev

def ev_to_shutter(ev: float, aperture: float) -> float:
    """Compute shutter speed (in 1/sec) from EV and aperture."""
    return (aperture ** 2) / (2 ** ev)

def ev_to_aperture(ev: float, shutter_speed: float) -> float:
    """Compute aperture from EV and shutter speed."""
    return math.sqrt((2 ** ev) * (1 / shutter_speed))

def ev_to_ev(ev: float) -> float:
    """Pass-through function to return entered EV directly."""
    return ev

def sunny_16_settings(iso: int, condition: str) -> tuple:
    """Suggest aperture and shutter based on lighting condition."""
    guide = {
        "Bright Sun": (16, 1 / iso),
        "Slight Overcast": (11, 1 / iso),
        "Overcast": (8, 1 / iso),
        "Heavy Overcast": (5.6, 1 / iso),
        "Open Shade/Sunset": (4, 1 / iso),
    }
    return guide.get(condition, (16, 1 / iso))

def zone_shift() -> dict:
    """EV adjustments for each zone in the Zone System."""
    return {
        "Zone 0 (Pure Black)": -5,
        "Zone I": -4,
        "Zone II (Shadow Detail)": -3,
        "Zone III": -2,
        "Zone IV": -1,
        "Zone V (Middle Gray)": 0,
        "Zone VI": 1,
        "Zone VII": 2,
        "Zone VIII (Highlight Detail)": 3,
        "Zone IX": 4,
        "Zone X (Paper White)": 5
    }
