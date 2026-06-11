/** @param {import('preact').JSX.HTMLAttributes<HTMLDivElement> & { padded?: boolean; stage?: boolean }} props */
export function Panel({ padded = false, stage = false, className = "", children, ...rest }) {
  const classes = [
    "ds-panel",
    padded && "ds-panel--padded",
    stage && "ds-panel--stage",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
