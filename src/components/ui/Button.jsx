/** @param {import('preact').JSX.HTMLAttributes<HTMLButtonElement> & { variant?: import('../../design/tokens.js').DsButtonVariant; size?: import('../../design/tokens.js').DsButtonSize; busy?: boolean; iconOnly?: boolean }} props */
export function Button({
  variant = "default",
  size = "md",
  busy = false,
  iconOnly = false,
  className = "",
  disabled,
  children,
  ...rest
}) {
  const classes = [
    "ds-btn",
    `ds-btn--${size}`,
    variant !== "default" && `ds-btn--${variant}`,
    iconOnly && "ds-btn--icon-only",
    busy && "ds-btn--busy",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled || busy} type="button" {...rest}>
      {children}
    </button>
  );
}
