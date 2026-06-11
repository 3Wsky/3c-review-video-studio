import { StatusPill } from "./StatusPill.jsx";

/** @param {{ title?: string; subtitle?: string; status?: string; statusTone?: 'default'|'success'|'warning'|'danger'; actions?: import('preact').ComponentChildren }} props */
export function TopBar({
  title = "Review Video Studio",
  subtitle = "导演台 · 一句话起片 · 横向时间线",
  status,
  statusTone = "default",
  actions
}) {
  return (
    <header className="ds-topbar">
      <div className="ds-brand">
        <div className="ds-brand__mark" aria-hidden="true">
          3C
        </div>
        <div>
          <h1 className="ds-brand__title">{title}</h1>
          <p className="ds-brand__subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="ds-topbar__actions">
        {status ? <StatusPill tone={statusTone}>{status}</StatusPill> : null}
        {actions}
      </div>
    </header>
  );
}
