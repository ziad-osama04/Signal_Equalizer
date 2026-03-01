import { useRef, useEffect } from 'react';

export default function CineViewer({ label, audioUrl }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!audioUrl) return;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const ctx = canvas.getContext('2d');

        // Set canvas resolution to match container size for sharpness
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const drawW = rect.width;
        const drawH = rect.height;

        const audioCtx = new AudioContext();

        fetch(audioUrl)
            .then(res => res.arrayBuffer())
            .then(buf => audioCtx.decodeAudioData(buf))
            .then(audioBuffer => {
                const data = audioBuffer.getChannelData(0);
                drawWaveform(ctx, drawW, drawH, data);
            })
            .catch(err => console.error('CineViewer decode error:', err));

        return () => audioCtx.close();
    }, [audioUrl]);

    function drawWaveform(ctx, w, h, data) {
        ctx.clearRect(0, 0, w, h);

        // Background
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, '#0f172a');
        gradient.addColorStop(1, '#1e293b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = (h / 5) * i;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Waveform — use min/max per pixel for accurate representation
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const samplesPerPixel = data.length / w;
        for (let i = 0; i < w; i++) {
            const startIdx = Math.floor(i * samplesPerPixel);
            const endIdx = Math.min(Math.floor((i + 1) * samplesPerPixel), data.length);

            let minVal = 1, maxVal = -1;
            for (let j = startIdx; j < endIdx; j++) {
                if (data[j] < minVal) minVal = data[j];
                if (data[j] > maxVal) maxVal = data[j];
            }

            const yMin = (1 - maxVal) * h / 2;
            const yMax = (1 - minVal) * h / 2;

            if (i === 0) {
                ctx.moveTo(i, yMin);
            }
            ctx.lineTo(i, yMin);
            ctx.lineTo(i, yMax);
        }
        ctx.stroke();

        // Center line
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
        ctx.setLineDash([]);
    }

    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{label}</span>
            <div ref={containerRef} className="rounded-lg border border-gray-700 w-full h-[150px] overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                    style={{ display: 'block' }}
                />
            </div>
        </div>
    );
}
