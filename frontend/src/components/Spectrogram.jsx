import { useRef, useEffect } from 'react';

export default function Spectrogram({ label, data }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!data || !data.Sxx || data.Sxx.length === 0) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        const ctx = canvas.getContext('2d');
        const { Sxx } = data;

        const numFreqs = Sxx.length;
        const numTimes = Sxx[0].length;

        // High-DPI scaling
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = numTimes;
        canvas.height = numFreqs;

        // Convert to log (dB) scale for visibility
        const logSxx = [];
        let maxLog = -Infinity, minLog = Infinity;
        for (let i = 0; i < numFreqs; i++) {
            logSxx[i] = [];
            for (let j = 0; j < numTimes; j++) {
                const val = Sxx[i][j] > 1e-12 ? 10 * Math.log10(Sxx[i][j]) : -120;
                logSxx[i][j] = val;
                if (val > maxLog) maxLog = val;
                if (val < minLog) minLog = val;
            }
        }

        // Clamp min to maxLog - 80 dB range
        const dbFloor = Math.max(minLog, maxLog - 80);
        const dbRange = maxLog - dbFloor;

        // Draw heatmap (frequency axis inverted so low freqs at bottom)
        const imgData = ctx.createImageData(numTimes, numFreqs);
        for (let i = 0; i < numFreqs; i++) {
            for (let j = 0; j < numTimes; j++) {
                const normalized = dbRange > 0 ? (logSxx[numFreqs - 1 - i][j] - dbFloor) / dbRange : 0;
                const val = Math.max(0, Math.min(1, normalized));
                const px = (i * numTimes + j) * 4;

                // Warm colormap: black → blue → cyan → yellow → white
                const intensity = val;
                if (intensity < 0.25) {
                    imgData.data[px] = 0;
                    imgData.data[px + 1] = 0;
                    imgData.data[px + 2] = Math.floor(intensity * 4 * 200);
                } else if (intensity < 0.5) {
                    imgData.data[px] = 0;
                    imgData.data[px + 1] = Math.floor((intensity - 0.25) * 4 * 255);
                    imgData.data[px + 2] = 200;
                } else if (intensity < 0.75) {
                    imgData.data[px] = Math.floor((intensity - 0.5) * 4 * 255);
                    imgData.data[px + 1] = 255;
                    imgData.data[px + 2] = Math.floor((0.75 - intensity) * 4 * 200);
                } else {
                    imgData.data[px] = 255;
                    imgData.data[px + 1] = 255;
                    imgData.data[px + 2] = Math.floor((intensity - 0.75) * 4 * 255);
                }
                imgData.data[px + 3] = 255;
            }
        }

        ctx.putImageData(imgData, 0, 0);
    }, [data]);

    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{label}</span>
            <div ref={containerRef} className="rounded-lg border border-gray-700 w-full h-[120px] overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                    style={{ imageRendering: 'pixelated', display: 'block' }}
                />
            </div>
        </div>
    );
}
