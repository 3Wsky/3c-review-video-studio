/** @param {import('preact').JSX.HTMLAttributes<HTMLSpanElement> & { tone?: 'default'|'success'|'warning'|'danger' }} props */
export function StatusPill({ tone = "default", className = "", children, ...rest }) {
  const classes = [
    "ds-status-pill",
    tone !== "default" && `ds-status-pill--${tone}`,
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
