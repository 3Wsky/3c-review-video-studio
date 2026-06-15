import { useEffect } from "preact/hooks";

/** 触发 legacy 工具栏按钮（director.js 已绑定 id） */
function triggerToolbar(id) {
  document.getElementById(id)?.click();
}

/** 导出菜单在工具栏内，先滚到编导区再展开 */
function openExportMenu() {
  document.getElementById("console-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => triggerToolbar("exportToggle"), 280);
}

const DOCK_ACTIONS = [
  { id: "checkup", target: "checkupBtn", label: "体检", icon: "stethoscope", accent: "checkup" },
  { id: "gate", target: "gateBtn", label: "闸门", icon: "shield-check", accent: "gate" },
  { id: "render", target: "renderVideoBtn", label: "渲染", icon: "clapperboard", accent: "render" },
  { id: "preview", target: "remotionPreviewBtn", label: "预览", icon: "play-circle" },
  { id: "export", label: "导出", icon: "file-down", onClick: openExportMenu }
];

export default function MobileActionDock() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.lucide?.createIcons) {
      window.lucide.createIcons();
    }
  }, []);

  return (
    <nav class="mobile-action-dock" aria-label="快捷操作坞">
      {DOCK_ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          class={`mobile-action-dock__btn${action.accent ? ` mobile-action-dock__btn--${action.accent}` : ""}`}
          onClick={() => (action.onClick ? action.onClick() : triggerToolbar(action.target))}
        >
          <i data-lucide={action.icon} aria-hidden="true" />
          <span>{action.label}</span>
        </button>
      ))}
    </nav>
  );
}
