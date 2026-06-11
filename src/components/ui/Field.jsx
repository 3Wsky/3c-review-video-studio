/** @param {import('preact').JSX.HTMLAttributes<HTMLLabelElement> & { label: string; hint?: string }} props */
export function Field({ label, hint, className = "", children, ...rest }) {
  return (
    <label className={`ds-field ${className}`.trim()} {...rest}>
      <span className="ds-field__label">{label}</span>
      {children}
      {hint ? <span className="ds-cue-hint">{hint}</span> : null}
    </label>
  );
}

/** @param {import('preact').JSX.HTMLAttributes<HTMLInputElement> & { fieldSize?: 'default'|'cue' }} props */
export function Input({ fieldSize = "default", className = "", ...rest }) {
  const sizeClass = fieldSize === "cue" ? "ds-field__control--cue" : "ds-field__control--input";
  return <input className={`ds-field__control ${sizeClass} ${className}`.trim()} {...rest} />;
}

/** @param {import('preact').JSX.HTMLAttributes<HTMLSelectElement>} props */
export function Select({ className = "", children, ...rest }) {
  return (
    <select className={`ds-field__control ds-field__control--select ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
}

/** @param {import('preact').JSX.HTMLAttributes<HTMLTextAreaElement>} props */
export function Textarea({ className = "", ...rest }) {
  return <textarea className={`ds-field__control ds-field__control--textarea ${className}`.trim()} {...rest} />;
}

/** @param {import('preact').JSX.HTMLAttributes<HTMLDivElement>} props */
export function FieldGrid({ className = "", children, ...rest }) {
  return (
    <div className={`ds-field-grid ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
