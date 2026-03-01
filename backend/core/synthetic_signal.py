import numpy as np

def generate_sine(freq, duration, sr=22050, amplitude=1.0):
    """Generates a pure sine wave."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    return amplitude * np.sin(2 * np.pi * freq * t), sr

def generate_composite(freqs, duration, sr=22050):
    """Generates a composite signal from multiple sine waves."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    signal = np.zeros_like(t)
    for f in freqs:
        signal += np.sin(2 * np.pi * f * t)
    return signal / len(freqs), sr

def generate_chirp(f_start, f_end, duration, sr=22050):
    """Generates a linear chirp signal (frequency sweep)."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    phase = 2 * np.pi * (f_start * t + (f_end - f_start) * t**2 / (2 * duration))
    return np.sin(phase), sr

def generate_noise(duration, sr=22050):
    """Generates white Gaussian noise."""
    n_samples = int(sr * duration)
    return np.random.randn(n_samples), sr
