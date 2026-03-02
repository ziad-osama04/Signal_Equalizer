import { useState, useCallback, useEffect } from 'react';
import { useSignal } from '../../core/SignalContext';
import WindowEditor from './WindowEditor';
import SliderControl from '../../components/SliderControl';

/**
 * GenericMode — Container component shown when mode === 'generic'.
 *
 * Features per task spec:
 *   • Arbitrary number of frequency subdivisions
 *   • Add subdivisions one by one — control location, width, and gain
 *   • Save/load band configurations as JSON settings files
 *   • Bidirectional sync between WindowEditor and SliderControls
 */

// Default 10-band equalizer preset
const DEFAULT_BANDS = [
    { start_freq: 20, end_freq: 45, gain: 1.0 },
    { start_freq: 45, end_freq: 90, gain: 1.0 },
    { start_freq: 90, end_freq: 180, gain: 1.0 },
    { start_freq: 180, end_freq: 355, gain: 1.0 },
    { start_freq: 355, end_freq: 710, gain: 1.0 },
    { start_freq: 710, end_freq: 1400, gain: 1.0 },
    { start_freq: 1400, end_freq: 2800, gain: 1.0 },
    { start_freq: 2800, end_freq: 5600, gain: 1.0 },
    { start_freq: 5600, end_freq: 11200, gain: 1.0 },
    { start_freq: 11200, end_freq: 20000, gain: 1.0 },
];

function bandLabel(band) {
    const hz = (band.start_freq + band.end_freq) / 2;
    if (hz >= 1000) return `${(hz / 1000).toFixed(1)}k`;
    return `${Math.round(hz)}`;
}

export default function GenericMode({ onWindowsChange }) {
    const { gains, setGains, windows, setWindows } = useSignal();
    const [bands, setBands] = useState(DEFAULT_BANDS);

    // Sync bands → parent windows + gains when bands change
    useEffect(() => {
        setWindows(bands.map(b => ({
            start_freq: b.start_freq,
            end_freq: b.end_freq,
            gain: b.gain,
        })));
        setGains(bands.map(b => b.gain));
        if (onWindowsChange) onWindowsChange(bands);
    }, [bands]);

    // Handle slider gain change — update band gain
    const updateGain = useCallback((index, value) => {
        setBands(prev => {
            const next = [...prev];
            next[index] = { ...next[index], gain: value };
            return next;
        });
    }, []);

    // Handle WindowEditor band geometry changes
    const handleBandsChange = useCallback((newBands) => {
        setBands(newBands);
    }, []);

    // ── Save/Load settings ──────────────────────────────
    const saveBands = () => {
        const json = JSON.stringify({ mode: 'generic', bands }, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generic_bands.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const loadBands = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.bands && Array.isArray(data.bands)) {
                    setBands(data.bands);
                }
            } catch (err) {
                console.error('Invalid settings file', err);
            }
        };
        reader.readAsText(file);
    };

    const resetBands = () => setBands(DEFAULT_BANDS);

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Header with save/load/reset */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                    🎛️ Generic Mode — Frequency Bands
                </h3>
                <div className="flex gap-1.5">
                    <button
                        onClick={saveBands}
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition"
                    >
                        💾 Save
                    </button>
                    <label className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded cursor-pointer transition">
                        📂 Load
                        <input type="file" accept=".json" onChange={loadBands} className="hidden" />
                    </label>
                    <button
                        onClick={resetBands}
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition"
                    >
                        🔄 Reset
                    </button>
                </div>
            </div>

            {/* WindowEditor — visual band editor */}
            <WindowEditor bands={bands} onBandsChange={handleBandsChange} />

            {/* Slider controls — one per band */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {bands.map((band, i) => (
                    <SliderControl
                        key={`generic-${i}`}
                        label={bandLabel(band)}
                        value={band.gain}
                        onChange={(v) => updateGain(i, v)}
                    />
                ))}
            </div>
        </div>
    );
}
