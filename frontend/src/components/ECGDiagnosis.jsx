import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function classifyEcg(fileId) {
    const res = await fetch(`${API_BASE}/api/ai/classify_ecg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId, mode: 'ecg' }),
    });
    if (!res.ok) throw new Error(`Classification failed: ${res.status}`);
    return res.json();
}

/**
 * ECGDiagnosis — 3-Tier ECG Risk Assessment
 * 
 * Tier 1 (Detected ≥15%):   🚨 RED — Arrhythmia confirmed
 * Tier 2 (Suspicious 8-15%): ⚠️ YELLOW — Suspicious pattern
 * Tier 3 (Healthy <8%):     ✅ GREEN — No concerning findings
 *
 * Props:
 *   fileId — UUID of the uploaded ECG file
 *   label  — Display context ("Original Signal", "Equalized Output", etc.)
 */
export default function ECGDiagnosis({ fileId, label = 'Signal' }) {
    const [result, setResult]   = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);

    // Auto-classify whenever a new file is uploaded
    useEffect(() => {
        if (!fileId) { setResult(null); return; }
        setLoading(true);
        setError(null);
        classifyEcg(fileId)
            .then(setResult)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [fileId]);

    if (!fileId) return null;

    return (
        <div className={`w-full rounded-xl border p-3 flex flex-col gap-2
            ${result?.is_diseased
                ? 'bg-red-950/40 border-red-800/60'
                : result?.is_suspicious
                    ? 'bg-yellow-950/30 border-yellow-800/50'
                    : result
                        ? 'bg-green-950/30 border-green-800/50'
                        : 'bg-gray-900/40 border-gray-700'
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    🩺 ECG Diagnosis
                    <span className="ml-1 text-[10px] font-normal text-gray-500 normal-case tracking-normal">
                        ({label})
                    </span>
                </span>
                {loading && (
                    <span className="text-[10px] text-gray-500 animate-pulse">
                        Analyzing…
                    </span>
                )}
                {!loading && fileId && (
                    <button
                        onClick={() => {
                            setLoading(true);
                            classifyEcg(fileId)
                                .then(setResult)
                                .catch(e => setError(e.message))
                                .finally(() => setLoading(false));
                        }}
                        className="text-[10px] text-gray-500 hover:text-gray-300 transition"
                    >
                        ↺ Re-analyze
                    </button>
                )}
            </div>

            {/* Error */}
            {error && (
                <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">
                    ⚠️ {error}
                </p>
            )}

            {/* Loading skeleton */}
            {loading && !result && (
                <div className="flex flex-col gap-1.5 animate-pulse">
                    <div className="h-3 bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-700 rounded w-1/2" />
                </div>
            )}

            {/* Results */}
            {result && !loading && (
                <>
                    {/* Main Diagnosis Message */}
                    <div className={`text-xs font-semibold leading-relaxed whitespace-pre-wrap
                        ${result.is_diseased 
                            ? 'text-red-300' 
                            : result.is_suspicious
                                ? 'text-yellow-300'
                                : 'text-green-300'
                        }`}>
                        {result.diagnosis}
                    </div>

                    {/* Detected Diseases (Tier 1 — Red Alert) */}
                    {result.detected_diseases?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="text-[10px] font-mono uppercase text-red-400">
                                CONFIRMED:
                            </span>
                            {result.detected_diseases.map(d => (
                                <span key={d}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold
                                               bg-red-900/60 text-red-200 border border-red-700/70 shadow-sm">
                                    🚨 {d}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Suspected Diseases (Tier 2 — Yellow Warning) */}
                    {result.suspected_diseases?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="text-[10px] font-mono uppercase text-yellow-400">
                                SUSPICIOUS:
                            </span>
                            {result.suspected_diseases.map(d => (
                                <span key={d}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold
                                               bg-yellow-900/50 text-yellow-200 border border-yellow-700/60">
                                    ⚠️ {d}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Score Bars for All 6 Classes */}
                    {result.all_scores && (
                        <div className="flex flex-col gap-1.5 mt-2 pt-1 border-t border-gray-700/40">
                            {Object.entries(result.all_scores).map(([name, score]) => {
                                const isDetected = (result.detected_diseases ?? []).includes(name);
                                const isSuspected = (result.suspected_diseases ?? []).includes(name);
                                const pct = Math.round(score * 100);
                                
                                // Color coding by tier
                                let barColor = 'bg-gray-700';
                                let labelColor = 'text-gray-400';
                                let percentColor = 'text-gray-500';
                                
                                if (isDetected) {
                                    barColor = 'bg-red-600';
                                    labelColor = 'text-red-300 font-semibold';
                                    percentColor = 'text-red-400';
                                } else if (isSuspected) {
                                    barColor = 'bg-yellow-600';
                                    labelColor = 'text-yellow-300 font-semibold';
                                    percentColor = 'text-yellow-400';
                                } else if (pct >= 1) {
                                    // Very faint for low-confidence items
                                    barColor = 'bg-cyan-700/50';
                                    labelColor = 'text-cyan-300/70';
                                    percentColor = 'text-cyan-400/60';
                                }

                                return (
                                    <div key={name} className="flex items-center gap-2 px-1">
                                        <span className={`text-[10px] w-40 truncate
                                            ${labelColor}`}>
                                            {name}
                                        </span>
                                        <div className="flex-1 h-2 bg-gray-800/60 rounded-full overflow-hidden border border-gray-700/30">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                                style={{ width: `${Math.max(pct, 2)}%` }}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-mono font-semibold w-10 text-right
                                            ${percentColor}`}>
                                            {pct}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Confidence Legend */}
                    <div className="flex items-center gap-3 mt-2 pt-1 border-t border-gray-700/40 text-[9px] text-gray-500">
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-600" />
                            <span>≥15% (Detected)</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-yellow-600" />
                            <span>8-15% (Suspicious)</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-cyan-700/50" />
                            <span>&lt;8% (Background)</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}