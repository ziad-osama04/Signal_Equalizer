import { createContext, useContext, useState } from 'react';

const SignalContext = createContext(null);

export function SignalProvider({ children }) {
    const [inputFile, setInputFile] = useState(null);   // { id, filename, duration_sec, sample_rate, num_samples }
    const [outputFile, setOutputFile] = useState(null);  // { output_id, duration_sec, ... }
    const [mode, setMode] = useState('generic');
    const [domain, setDomain] = useState('fourier');
    const [gains, setGains] = useState([]);
    const [windows, setWindows] = useState([]);          // generic mode only
    const [spectrogram, setSpectrogram] = useState(null);
    const [inputSpectrogram, setInputSpectrogram] = useState(null);

    // Frequency scale: 'linear' or 'audiogram' (log)
    const [freqScale, setFreqScale] = useState('audiogram');

    return (
        <SignalContext.Provider value={{
            inputFile, setInputFile,
            outputFile, setOutputFile,
            mode, setMode,
            domain, setDomain,
            gains, setGains,
            windows, setWindows,
            spectrogram, setSpectrogram,
            inputSpectrogram, setInputSpectrogram,
            freqScale, setFreqScale,
        }}>
            {children}
        </SignalContext.Provider>
    );
}

export function useSignal() {
    const ctx = useContext(SignalContext);
    if (!ctx) throw new Error('useSignal must be used within SignalProvider');
    return ctx;
}
