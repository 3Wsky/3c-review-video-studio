import { useEffect } from "preact/hooks";

/**
 * Toast — 轻量级通知消息组件
 * @param {{
 *   message: string;
 *   tone?: 'default'|'success'|'warning'|'danger';
 *   duration?: number;
 *   onClose: () => void;
 *   className?: string;
 * }} props
 */
export function Toast({
  message,
  tone = "default",
  duration = 4000,
  onClose,
  className = ""
}) {
  useEffect(() => {
    if (!duration || duration <= 0) return;
    const timer = setTimeout(() => {
      onClose && onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`ds-toast ds-toast--${tone} ${className}`.trim()} role="alert">
      <div className="ds-toast__content">{message}</div>
      <button type="button" className="ds-toast__close" onClick={onClose} aria-label="关闭">
        &times;
      </button>
    </div>
  );
}
