/** @typedef {'sm'|'md'|'lg'|'xl'|'2xl'|'pill'} DsRadius */
/** @typedef {'xs'|'sm'|'base'|'md'|'lg'|'xl'} DsTextSize */
/** @typedef {'default'|'primary'|'danger'|'ghost'} DsButtonVariant */
/** @typedef {'sm'|'md'|'lg'} DsButtonSize */

export const colors = {
  bg: "#08080f",
  panel: "rgba(22, 22, 33, 0.72)",
  panel2: "rgba(30, 30, 45, 0.7)",
  soft: "rgba(255, 255, 255, 0.045)",
  ink: "#eef0f6",
  muted: "#9aa0b4",
  line: "rgba(255, 255, 255, 0.1)",
  accent: "#b16bff",
  accentDark: "#8b3bf0",
  accentSoft: "rgba(177, 107, 255, 0.16)",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#ff6b6b",
  info: "#7aa2ff"
};

export const gradients = {
  accent: "linear-gradient(135deg, #ff4d9d 0%, #b16bff 52%, #6f7bff 100%)",
  stageBorder: "linear-gradient(120deg, rgba(255, 77, 157, 0.5), rgba(111, 123, 255, 0.4), transparent 70%)"
};

export const typography = {
  fontSans:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
  fontMono: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace',
  sizes: {
    xs: "11px",
    sm: "12px",
    base: "13px",
    md: "16px",
    lg: "18px",
    xl: "19px"
  },
  weights: {
    normal: 400,
    medium: 600,
    bold: 700,
    heavy: 750,
    black: 800
  }
};

export const spacing = {
  1: "4px",
  2: "6px",
  3: "8px",
  4: "10px",
  5: "12px",
  6: "14px",
  7: "16px",
  8: "18px",
  9: "22px",
  10: "28px"
};

export const radii = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "18px",
  pill: "999px"
};

export const shadows = {
  panel: "0 18px 50px rgba(0, 0, 0, 0.45)",
  accent: "0 10px 28px rgba(177, 107, 255, 0.4)",
  accentHover: "0 14px 34px rgba(177, 107, 255, 0.55)"
};

export const layout = {
  topbarHeight: "76px",
  directorMaxWidth: "1180px",
  cueHeight: "56px"
};

export const motion = {
  ease: "cubic-bezier(0.4, 0, 0.2, 1)",
  fast: "0.12s",
  normal: "0.16s",
  slow: "0.24s"
};

/** 质检/留人分色阶 */
export const scoreColors = {
  high: "#34d399",
  mid: "#fbbf24",
  low: "#ff6b6b"
};
