import { useSignal } from '../core/SignalContext';

const DOMAINS = [
    { value: 'fourier', label: '📊 Fourier (FFT)' },
    { value: 'dct', label: '📐 DCT' },
    { value: 'haar_wavelet', label: '〰️ Haar Wavelet' },
];

export default function DomainSelector() {
    const { domain, setDomain } = useSignal();

    return (
        <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
        >
            {DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
            ))}
        </select>
    );
}
