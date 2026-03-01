export default function SliderControl({ label, value, onChange, min = 0, max = 2, step = 0.01 }) {
    return (
        <div className="flex flex-col items-center gap-1 min-w-[60px]">
            <span className="text-xs text-gray-400 font-medium text-center leading-tight">{label}</span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-24 appearance-none cursor-pointer accent-cyan-500"
                orient="vertical"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
            />
            <span className="text-xs text-cyan-400 font-mono">{value.toFixed(2)}</span>
        </div>
    );
}
