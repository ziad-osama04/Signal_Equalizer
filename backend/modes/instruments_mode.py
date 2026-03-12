import json
import os
from modes.generic_mode import apply_generic_eq

SETTINGS_PATH = os.path.join(os.path.dirname(__file__), "..", "settings", "instruments.json")

def load_instruments_config():
    """Loads the instruments mode slider configuration from the JSON file."""
    with open(SETTINGS_PATH, "r") as f:
        return json.load(f)

def apply_instruments_eq(signal, sr, gains, domain="fourier"):
    """
    Instruments Mode equalizer: maps each slider gain to the instrument's frequency ranges.
    
    Args:
        signal: 1D numpy array
        sr: sample rate
        gains: list of floats (one per slider, same order as config sliders)
        domain: transform domain ("fourier", "dct", "haar_wavelet")
    
    Returns:
        output_signal: 1D numpy array
    """
    config = load_instruments_config()
    sliders = config["sliders"]
    
    # Build the windows list from config + user gains
    windows = []
    for i, slider in enumerate(sliders):
        gain = gains[i] if i < len(gains) else slider.get("default_gain", 1.0)
        for rng in slider["ranges"]:
            windows.append({
                "start_freq": rng[0],
                "end_freq": rng[1],
                "gain": gain
            })
    
    return apply_generic_eq(signal, sr, windows, domain=domain, base_gain=0.0)
