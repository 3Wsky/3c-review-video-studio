/** @param {{ options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void; columns?: 2|3|4; className?: string }} props */
export function SegmentGroup({ options, value, onChange, columns = 4, className = "" }) {
  return (
    <div className={`ds-segment ds-segment--cols-${columns} ${className}`.trim()} role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`ds-segment__item ${value === opt.value ? "ds-segment__item--active" : ""}`.trim()}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
