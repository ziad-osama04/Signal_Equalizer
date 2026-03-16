import { useState, useEffect, useCallback } from 'react';
import { useSignal } from '../core/SignalContext';
import { getModeSettings, processSignal } from '../core/ApiService';
import SliderControl from './SliderControl';
import FFTViewer from './FFTViewer';
import ECGDiagnosis from './ECGDiagnosis';

/**
 * Optimal wavelet per custom mode (from domain_config.json research).
 */
const OPTIMAL_WAVELET = {
    instruments: 'dwt_symlet8',
    voices:      'dwt_db4',
    animals:     'cwt_morlet',
    ecg:         'dwt_db4',
};

const WAVELET_LABELS = {
    dwt_symlet8: 'DWT Symlet-8',
    dwt_db4:     'DWT Daubechies-4',
    cwt_morlet:  'CWT Morlet',
};

/**
 * DualDomainPanel — Shown for all custom modes (instruments, voices, animals, ecg).
 *
 * Renders two independent equalization sections:
 *   1. Frequency Domain  — FFT plot + frequency-based sliders (domain = "fourier")
 *   2. Wavelet Domain    — wavelet plot + wavelet-based sliders (mode-optimal wavelet)
 *
 * Each section processes independently and displays its own FFT/wavelet magnitude plot.
 */
export default function DualDomainPanel() {
    const {
        inputFile,
        mode,
        gains, setGains,
        outputFile, setOutputFile,
        spectrogram, setSpectrogram,
        waveletGains, setWaveletGains,
        waveletOutputFile, setWaveletOutputFile,
        waveletSpectrogram, setWaveletSpectrogram,
    } = useSignal();

    const [sliderConfig, setSliderConfig] = useState([]);
    const [freqLoading, setFreqLoading] = useState(false);
    const [waveletLoading, setWaveletLoading] = useState(false);

    const optimalWavelet = OPTIMAL_WAVELET[mode] || 'dwt_db4';
    const waveletLabel = WAVELET_LABELS[optimalWavelet] || optimalWavelet;

    // Load slider config when mode changes
    useEffect(() => {
        getModeSettings(mode).then((data) => {
            setSliderConfig(data.sliders);
            setGains(data.sliders.map((s) => s.default_gain));
            setWaveletGains(data.sliders.map((s) => s.default_gain));
        }).catch(console.error);
    }, [mode]);

    // --- Frequency Domain Processing ---
    const processFrequency = useCallback(async () => {
        if (!inputFile || sliderConfig.length === 0) return;
        setFreqLoading(true);
        try {
            const result = await processSignal({
                file_id: inputFile.id,
                mode,
                gains,
                domain: 'fourier',
            });
            setOutputFile(result);
            setSpectrogram(result.spectrogram);
        } catch (err) {
            console.error('Frequency process error:', err);
        }
        setFreqLoading(false);
    }, [inputFile, mode, gains, sliderConfig]);

    // Auto-apply frequency domain changes (debounced)
    useEffect(() => {
        if (!inputFile || sliderConfig.length === 0) return;
        const timer = setTimeout(processFrequency, 400);
        return () => clearTimeout(timer);
    }, [processFrequency]);

    // --- Wavelet Domain Processing ---
    const processWavelet = useCallback(async () => {
        if (!inputFile || sliderConfig.length === 0) return;
        setWaveletLoading(true);
        try {
            const result = await processSignal({
                file_id: inputFile.id,
                mode,
                gains: waveletGains,
                domain: optimalWavelet,
            });
            setWaveletOutputFile(result);
            setWaveletSpectrogram(result.spectrogram);
        } catch (err) {
            console.error('Wavelet process error:', err);
        }
        setWaveletLoading(false);
    }, [inputFile, mode, waveletGains, optimalWavelet, sliderConfig]);

    // Auto-apply wavelet domain changes (debounced)
    useEffect(() => {
        if (!inputFile || sliderConfig.length === 0) return;
        const timer = setTimeout(processWavelet, 400);
        return () => clearTimeout(timer);
    }, [processWavelet]);

    // Slider updaters
    const updateFreqGain = (index, value) => {
        const next = [...gains];
        next[index] = value;
        setGains(next);
    };

    const updateWaveletGain = (index, value) => {
        const next = [...waveletGains];
        next[index] = value;
        setWaveletGains(next);
    };

    return (
        <div className="flex flex-col gap-4 w-full">
            {/* ─── ECG Diagnosis Panel (ECG mode only) ─── */}
        {mode === 'ecg' && (
            <ECGDiagnosis
                fileId={outputFile?.output_id || inputFile?.id}
                label={outputFile ? 'Equalized Output' : 'Original Signal'}
            />
        )}

        {/* ─── Frequency Domain Section ─── */}
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-gray-800/40 border border-cyan-900/40">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                        📊 Frequency Domain (Fourier)
                    </span>
                    {freqLoading && <span className="text-[10px] text-gray-500 animate-pulse">processing…</span>}
                </div>

                {/* FFT Plot for frequency domain */}
                <FFTViewer label="Freq" fileId={outputFile?.output_id} forceDomain="fourier" />

                {/* Frequency-based sliders */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {sliderConfig.map((s, i) => (
                        <SliderControl
                            key={`freq-${mode}-${i}`}
                            label={s.label}
                            value={gains[i] ?? 1}
                            onChange={(v) => updateFreqGain(i, v)}
                        />
                    ))}
                </div>
            </div>

            {/* ─── Wavelet Domain Section ─── */}
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-gray-800/40 border border-purple-900/40">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                        🌊 Wavelet Domain ({waveletLabel})
                    </span>
                    {waveletLoading && <span className="text-[10px] text-gray-500 animate-pulse">processing…</span>}
                </div>

                {/* Wavelet Plot */}
                <FFTViewer label="Wavelet" fileId={waveletOutputFile?.output_id} forceDomain={optimalWavelet} />

                {/* Wavelet-based sliders */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {sliderConfig.map((s, i) => (
                        <SliderControl
                            key={`wav-${mode}-${i}`}
                            label={s.label}
                            value={waveletGains[i] ?? 1}
                            onChange={(v) => updateWaveletGain(i, v)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
