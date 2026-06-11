/**
 * ClipCard — 单个分镜卡片组件（纵向列表项）
 * @param {{
 *   scene: { id: string; start: number; end: number; voiceover: string; subtitle?: string; visual?: { type: string; asset?: string } };
 *   index: number;
 *   active: boolean;
 *   onSelect: () => void;
 *   onPlayTts?: () => void;
 *   onDelete?: () => void;
 *   className?: string;
 * }} props
 */
export function ClipCard({
  scene,
  index,
  active = false,
  onSelect,
  onPlayTts,
  onDelete,
  className = ""
}) {
  const duration = scene.end - scene.start;

  return (
    <div
      className={`ds-clip-card ${active ? "ds-clip-card--active" : ""} ${className}`.trim()}
      onClick={onSelect}
    >
      <header className="ds-clip-card__header">
        <div className="ds-clip-card__meta">
          <span className="ds-clip-card__index">S{index + 1}</span>
          <span className="ds-clip-card__time">
            {scene.start.toFixed(1)}s - {scene.end.toFixed(1)}s
          </span>
          <span className="ds-clip-card__duration">({duration.toFixed(1)}s)</span>
        </div>
        <div className="ds-clip-card__actions" onClick={(e) => e.stopPropagation()}>
          {onPlayTts ? (
            <button
              type="button"
              className="ds-clip-card__btn"
              onClick={onPlayTts}
              title="试听配音"
            >
              试听
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="ds-clip-card__btn ds-clip-card__btn--danger"
              onClick={onDelete}
              title="删除镜头"
            >
              删除
            </button>
          ) : null}
        </div>
      </header>

      <div className="ds-clip-card__body">
        <p className="ds-clip-card__voiceover" title={scene.voiceover}>
          {scene.voiceover || <span className="ds-clip-card__empty">暂无口播文案</span>}
        </p>
        {scene.visual ? (
          <div className="ds-clip-card__visual-tag">
            <span>{scene.visual.type || "无视觉类型"}</span>
            {scene.visual.asset ? (
              <span className="ds-clip-card__asset-name"> · {scene.visual.asset}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
