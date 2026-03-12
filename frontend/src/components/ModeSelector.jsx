import { useSignal } from '../core/SignalContext';

const MODES = [
    { value: 'generic', label: '🎛️ Generic Mode' },
    { value: 'instruments', label: '🎸 Musical Instruments' },
    { value: 'animals', label: '🐾 Animal Sounds' },
    { value: 'voices', label: '🗣️ Human Voices' },
    { value: 'ecg', label: '🫀 ECG Abnormalities' },
];

export default function ModeSelector() {
    const { mode, setMode } = useSignal();

    return (
        <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none cursor-pointer"
        >
            {MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
            ))}
        </select>
    );
}
