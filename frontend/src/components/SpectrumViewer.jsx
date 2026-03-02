import { useRef, useEffect } from 'react';

/**
 * SpectrumViewer — real-time frequency spectrum bar chart.
 * Reads from an AudioEngine's AnalyserNode via requestAnimationFrame.
 *
 * Props:
 *   audioEngine — AudioEngine instance (provides getFrequencyData())
 *   isPlaying   — whether audio is currently playing
 */
export default function SpectrumViewer({ audioEngine, isPlaying }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const rafRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const W = rect.width;
        const H = rect.height;

        function draw() {
            ctx.clearRect(0, 0, W, H);

            // Background
            const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
            bgGrad.addColorStop(0, '#0f172a');
            bgGrad.addColorStop(1, '#1e293b');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            const data = audioEngine?.getFrequencyData();
            if (!data || !isPlaying) {
                // Draw idle state
                ctx.fillStyle = 'rgba(100,116,139,0.3)';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('▶ Play audio to see spectrum', W / 2, H / 2);
                return;
            }

            const barCount = Math.min(data.length, 64);
            const step = Math.floor(data.length / barCount);
            const barWidth = W / barCount - 1;

            for (let i = 0; i < barCount; i++) {
                const value = data[i * step] / 255;
                const barH = value * H * 0.9;

                // Gradient from cyan to blue
                const grad = ctx.createLinearGradient(0, H - barH, 0, H);
                grad.addColorStop(0, `hsl(${185 - i * 1.5}, 80%, 60%)`);
                grad.addColorStop(1, `hsl(${200 - i * 1.5}, 90%, 30%)`);
                ctx.fillStyle = grad;

                const x = i * (barWidth + 1);
                ctx.fillRect(x, H - barH, barWidth, barH);
            }

            rafRef.current = requestAnimationFrame(draw);
        }

        if (isPlaying) {
            rafRef.current = requestAnimationFrame(draw);
        } else {
            draw(); // draw idle state
        }

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [audioEngine, isPlaying]);

    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                Frequency Spectrum
            </span>
            <div ref={containerRef} className="rounded-lg border border-gray-700 w-full h-[100px] overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                    style={{ display: 'block' }}
                />
            </div>
        </div>
    );
}
