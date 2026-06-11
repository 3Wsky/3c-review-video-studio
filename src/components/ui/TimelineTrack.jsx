import { useMemo } from "preact/hooks";

/**
 * TimelineTrack — 横向时间线轨道与标尺组件
 * @param {{
 *   scenes: Array<{ id: string; start: number; end: number; label: string; voiceover?: string }>;
 *   currentSceneIndex: number;
 *   onSelectScene: (index: number) => void;
 *   className?: string;
 * }} props
 */
export function TimelineTrack({
  scenes = [],
  currentSceneIndex = 0,
  onSelectScene,
  className = ""
}) {
  const totalDuration = useMemo(() => {
    if (scenes.length === 0) return 0;
    return scenes[scenes.length - 1].end;
  }, [scenes]);

  // 生成时间刻度（每 5 秒一个刻度）
  const ticks = useMemo(() => {
    const list = [];
    const step = 5;
    const max = Math.ceil(totalDuration);
    for (let i = 0; i <= max; i += step) {
      list.push(i);
    }
    return list;
  }, [totalDuration]);

  if (scenes.length === 0) {
    return (
      <div className={`ds-timeline-empty ${className}`.trim()}>
        暂无分镜时间轴数据
      </div>
    );
  }

  return (
    <div className={`ds-timeline-container ${className}`.trim()}>
      {/* 时间轴标尺 */}
      <div className="ds-timeline-ruler">
        {ticks.map((tick) => {
          const leftPercent = totalDuration > 0 ? (tick / totalDuration) * 100 : 0;
          return (
            <div
              key={tick}
              className="ds-timeline-tick"
              style={{ left: `${leftPercent}%` }}
            >
              <span className="ds-timeline-tick-label">{tick}s</span>
            </div>
          );
        })}
      </div>

      {/* 轨道色块 */}
      <div className="ds-timeline-track">
        {scenes.map((scene, index) => {
          const duration = scene.end - scene.start;
          const widthPercent = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
          const leftPercent = totalDuration > 0 ? (scene.start / totalDuration) * 100 : 0;
          const isActive = index === currentSceneIndex;

          return (
            <button
              key={scene.id || index}
              type="button"
              className={`ds-timeline-clip ${isActive ? "ds-timeline-clip--active" : ""}`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`
              }}
              onClick={() => onSelectScene && onSelectScene(index)}
              title={`${scene.label || `镜头 ${index + 1}`} (${duration.toFixed(1)}s)`}
            >
              <div className="ds-timeline-clip-inner">
                <span className="ds-timeline-clip-title">
                  {scene.label || `S${index + 1}`}
                </span>
                <span className="ds-timeline-clip-duration">
                  {duration.toFixed(1)}s
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
