import { useEffect } from "preact/hooks";
import { Button } from "./Button.jsx";

/**
 * Modal — 全屏毛玻璃遮罩弹窗组件
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   title: string;
 *   subtitle?: string;
 *   size?: 'sm'|'md'|'lg';
 *   children: import('preact').ComponentChildren;
 *   actions?: import('preact').ComponentChildren;
 *   className?: string;
 * }} props
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  children,
  actions,
  className = ""
}) {
  // 监听 ESC 键关闭
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose && onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ds-modal-mask" onClick={onClose}>
      <div
        className={`ds-modal-card ds-modal-card--${size} ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="ds-modal-head">
          <div>
            <h3 className="ds-modal-title">{title}</h3>
            {subtitle ? <p className="ds-modal-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="ds-modal-close"
            onClick={onClose}
            aria-label="关闭弹窗"
          >
            &times;
          </button>
        </header>

        <div className="ds-modal-body">{children}</div>

        {actions ? <footer className="ds-modal-foot">{actions}</footer> : null}
      </div>
    </div>
  );
}
