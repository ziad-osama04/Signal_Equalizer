import { useRef, useEffect, useState, useCallback } from 'react';
import { useSync } from '../core/SyncContext';

/**
 * CineViewer — Linked waveform viewer with:
 *   • Synced playhead (from SyncContext)
 *   • Zoom (scroll wheel) & Pan (click-drag) — linked across input/output
 *   • High-DPI canvas rendering with min/max waveform
 */
export default function CineViewer({ label, audioUrl }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const audioDataRef = useRef(null);
    const sampleRateRef = useRef(44100);

    const {
        currentTime, duration, setDuration,
        viewStart, setViewStart, viewEnd, setViewEnd,
    } = useSync();

    // Decode and store audio samples
    useEffect(() => {
        if (!audioUrl) { audioDataRef.current = null; return; }

        const audioCtx = new AudioContext();
        fetch(audioUrl)
            .then(res => res.arrayBuffer())
            .then(buf => audioCtx.decodeAudioData(buf))
            .then(audioBuffer => {
                audioDataRef.current = audioBuffer.getChannelData(0);
                sampleRateRef.current = audioBuffer.sampleRate;
                const dur = audioBuffer.duration;
                setDuration(prev => Math.max(prev, dur));
            })
            .catch(err => console.error('CineViewer decode error:', err));

        return () => audioCtx.close();
    }, [audioUrl]);

    // Draw waveform whenever view changes or playhead moves
    useEffect(() => {
        const data = audioDataRef.current;
        if (!data) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const w = rect.width;
        const h = rect.height;

        const sr = sampleRateRef.current;
        const totalDur = data.length / sr;

        const vStart = viewStart;
        const vEnd = viewEnd ?? totalDur;
        const vDuration = vEnd - vStart;

        ctx.clearRect(0, 0, w, h);

        // Background gradient
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

        // Time grid (vertical)
        const timeStep = Math.pow(10, Math.floor(Math.log10(vDuration / 5)));
        const firstTime = Math.ceil(vStart / timeStep) * timeStep;
        ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.font = '9px monospace';
        for (let t = firstTime; t <= vEnd; t += timeStep) {
            const x = ((t - vStart) / vDuration) * w;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            ctx.fillText(`${t.toFixed(2)}s`, x + 2, h - 3);
        }

        // Waveform — min/max per pixel for accurate representation
        const startSample = Math.floor(vStart * sr);
        const endSample = Math.min(Math.floor(vEnd * sr), data.length);
        const visibleSamples = endSample - startSample;
        const samplesPerPixel = visibleSamples / w;

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let i = 0; i < w; i++) {
            const sIdx = startSample + Math.floor(i * samplesPerPixel);
            const eIdx = Math.min(startSample + Math.floor((i + 1) * samplesPerPixel), data.length);

            let minVal = 1, maxVal = -1;
            for (let j = sIdx; j < eIdx; j++) {
                if (data[j] < minVal) minVal = data[j];
                if (data[j] > maxVal) maxVal = data[j];
            }

            const yMin = (1 - maxVal) * h / 2;
            const yMax = (1 - minVal) * h / 2;

            if (i === 0) ctx.moveTo(i, yMin);
            ctx.lineTo(i, yMin);
            ctx.lineTo(i, yMax);
        }
        ctx.stroke();

        // Centre line
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
        ctx.setLineDash([]);

        // Playhead
        if (currentTime >= vStart && currentTime <= vEnd) {
            const px = ((currentTime - vStart) / vDuration) * w;
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
            ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }, [audioUrl, currentTime, viewStart, viewEnd]);

    // Zoom handler (scroll wheel)
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const data = audioDataRef.current;
        if (!data) return;
        const totalDur = data.length / sampleRateRef.current;
        const vEnd_ = viewEnd ?? totalDur;
        const vDuration = vEnd_ - viewStart;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const ratio = mouseX / rect.width;

        const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8;
        const newDuration = Math.max(0.01, Math.min(totalDur, vDuration * zoomFactor));
        const mouseTime = viewStart + ratio * vDuration;
        const newStart = Math.max(0, mouseTime - ratio * newDuration);
        const newEnd = Math.min(totalDur, newStart + newDuration);

        setViewStart(newStart);
        setViewEnd(newEnd);
    }, [viewStart, viewEnd]);

    // Pan handler (mouse drag)
    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        const data = audioDataRef.current;
        if (!data) return;
        const totalDur = data.length / sampleRateRef.current;
        const vEnd_ = viewEnd ?? totalDur;
        const vDuration = vEnd_ - viewStart;

        const startX = e.clientX;
        const rect = containerRef.current.getBoundingClientRect();

        const handleMove = (mv) => {
            const dx = mv.clientX - startX;
            const dt = -(dx / rect.width) * vDuration;
            const newStart = Math.max(0, Math.min(totalDur - vDuration, viewStart + dt));
            setViewStart(newStart);
            setViewEnd(newStart + vDuration);
        };
        const handleUp = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    }, [viewStart, viewEnd]);

    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{label}</span>
            <div
                ref={containerRef}
                className="rounded-lg border border-gray-700 w-full h-[150px] overflow-hidden"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
            >
                <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                    style={{ display: 'block' }}
                />
            </div>
        </div>
    );
}
