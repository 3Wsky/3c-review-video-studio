/** @param {{ summary: import('preact').ComponentChildren; children: import('preact').ComponentChildren; open?: boolean; className?: string }} props */
export function Collapsible({ summary, children, open, className = "" }) {
  return (
    <details className={`ds-collapsible ${className}`.trim()} open={open}>
      <summary>{summary}</summary>
      <div className="ds-collapsible__body">{children}</div>
    </details>
  );
}
