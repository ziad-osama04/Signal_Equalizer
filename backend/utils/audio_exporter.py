import soundfile as sf
import numpy as np

def save_audio(data, sr, file_path):
    """
    Saves a 1D numpy array as a WAV file.
    """
    sf.write(file_path, np.asarray(data), sr)
