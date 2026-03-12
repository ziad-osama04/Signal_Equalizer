"""
Synthetic Signal Generator
===========================
Creates a test signal composed of known pure single frequencies
across the audible range. Used to validate the equalizer by checking
that specific frequency bands can be boosted/attenuated independently.

Frequencies included:
    100 Hz, 300 Hz, 500 Hz, 1000 Hz, 2000 Hz, 5000 Hz, 8000 Hz, 12000 Hz

Usage:
    python backend/utils/generate_synthetic.py
"""

import numpy as np
import os

try:
    import soundfile as sf
except ImportError:
    import scipy.io.wavfile as wavfile
    sf = None


SAMPLE_RATE = 44100
DURATION = 5.0  # seconds
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "dataset", "synthetic_signal.wav"
)

# Pure frequencies spanning the full audible range
FREQUENCIES = [100, 300, 500, 1000, 2000, 5000, 8000, 12000]


def generate_synthetic_signal(
    freqs=FREQUENCIES, sr=SAMPLE_RATE, duration=DURATION
) -> np.ndarray:
    """
    Generates a signal that is the sum of pure sine waves at the given frequencies.

    Args:
        freqs: list of frequencies in Hz
        sr: sample rate
        duration: length in seconds

    Returns:
        1D numpy array (float64), normalised to [-0.9, 0.9]
    """
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    signal = np.zeros_like(t)

    for f in freqs:
        signal += np.sin(2 * np.pi * f * t)

    # Normalise to avoid clipping
    peak = np.abs(signal).max()
    if peak > 0:
        signal = signal * (0.9 / peak)

    return signal


if __name__ == "__main__":
    print(f"Generating synthetic signal with frequencies: {FREQUENCIES}")
    print(f"  Sample rate : {SAMPLE_RATE} Hz")
    print(f"  Duration    : {DURATION} s")

    sig = generate_synthetic_signal()

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    if sf is not None:
        sf.write(OUTPUT_PATH, sig, SAMPLE_RATE)
    else:
        wavfile.write(OUTPUT_PATH, SAMPLE_RATE, (sig * 32767).astype(np.int16))

    print(f"  Saved to    : {os.path.abspath(OUTPUT_PATH)}")
    print("Done.")
