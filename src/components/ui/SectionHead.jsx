/** @param {{ title: string; action?: import('preact').ComponentChildren }} props */
export function SectionHead({ title, action }) {
  return (
    <div className="ds-section-head">
      <h2>{title}</h2>
      {action}
    </div>
  );
}
