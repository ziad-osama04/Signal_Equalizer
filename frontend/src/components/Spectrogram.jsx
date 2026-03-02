import { useRef, useEffect } from 'react';
import { useSync } from '../core/SyncContext';

/**
 * Spectrogram — Canvas heatmap with synced playhead overlay.
 *
 * Props:
 *   label — display label
 *   data  — { f: [], t: [], Sxx: [[]] }
 */
export default function Spectrogram({ label, data }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const { currentTime } = useSync();

    useEffect(() => {
        if (!data || !data.Sxx || data.Sxx.length === 0) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        const ctx = canvas.getContext('2d');
        const { Sxx, t } = data;

        const numFreqs = Sxx.length;
        const numTimes = Sxx[0].length;

        canvas.width = numTimes;
        canvas.height = numFreqs;

        // Convert to log (dB) scale
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

        const dbFloor = Math.max(minLog, maxLog - 80);
        const dbRange = maxLog - dbFloor;

        // Draw heatmap (low freqs at bottom)
        const imgData = ctx.createImageData(numTimes, numFreqs);
        for (let i = 0; i < numFreqs; i++) {
            for (let j = 0; j < numTimes; j++) {
                const normalized = dbRange > 0 ? (logSxx[numFreqs - 1 - i][j] - dbFloor) / dbRange : 0;
                const val = Math.max(0, Math.min(1, normalized));
                const px = (i * numTimes + j) * 4;

                // Colormap: black → blue → cyan → yellow → white
                if (val < 0.25) {
                    imgData.data[px] = 0;
                    imgData.data[px + 1] = 0;
                    imgData.data[px + 2] = Math.floor(val * 4 * 200);
                } else if (val < 0.5) {
                    imgData.data[px] = 0;
                    imgData.data[px + 1] = Math.floor((val - 0.25) * 4 * 255);
                    imgData.data[px + 2] = 200;
                } else if (val < 0.75) {
                    imgData.data[px] = Math.floor((val - 0.5) * 4 * 255);
                    imgData.data[px + 1] = 255;
                    imgData.data[px + 2] = Math.floor((0.75 - val) * 4 * 200);
                } else {
                    imgData.data[px] = 255;
                    imgData.data[px + 1] = 255;
                    imgData.data[px + 2] = Math.floor((val - 0.75) * 4 * 255);
                }
                imgData.data[px + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        // Draw playhead line
        if (t && t.length > 0 && currentTime > 0) {
            const tMax = t[t.length - 1];
            if (currentTime <= tMax) {
                const px = (currentTime / tMax) * numTimes;
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(px, 0);
                ctx.lineTo(px, numFreqs);
                ctx.stroke();
            }
        }
    }, [data, currentTime]);

    return (
        <div className="flex flex-col gap-1">
            {label && <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{label}</span>}
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
