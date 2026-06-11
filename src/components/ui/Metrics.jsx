/** @param {{ items: Array<{ label: string; value: string|number }> }} props */
export function Metrics({ items }) {
  return (
    <div className="ds-metrics">
      {items.map((item) => (
        <div className="ds-metric" key={item.label}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
