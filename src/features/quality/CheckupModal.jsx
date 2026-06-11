import { Modal, Button } from "../../components/ui/index.js";
import { selectScene, rewriteScene } from "../editor/editor-bridge.js";
import { toneColor, scoreTone } from "./score-utils.js";

/**
 * @param {{
 *   open: boolean;
 *   report: import('./quality-types.js').RetentionReport | null;
 *   onClose: () => void;
 * }} props
 */
export function CheckupModal({ open, report, onClose }) {
  if (!open || !report) return null;

  const ringColor = toneColor(report.grade.tone);

  const handleJump = (pos) => {
    selectScene(pos);
    onClose();
    document.querySelector(".clip-editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleRewrite = async (pos) => {
    selectScene(pos);
    onClose();
    document.querySelector(".clip-editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
    await rewriteScene(pos);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="留人体检"
      icon={<i data-lucide="stethoscope" />}
      subtitle="按短视频留人逻辑（前 5 秒钩子 + 情绪曲线）给当前脚本打分，仅供参考"
      size="lg"
      className="ds-checkup-modal"
    >
      <div className="ds-checkup-overall">
        <div
          className="ds-checkup-ring"
          style={{
            background: `conic-gradient(${ringColor} ${report.overall * 3.6}deg, rgba(255,255,255,0.08) 0)`
          }}
        >
          <div className="ds-checkup-ring-in">
            <strong>{report.overall}</strong>
            <small style={{ color: ringColor }}>{report.grade.label}</small>
          </div>
        </div>

        <div className="ds-checkup-dims">
          {report.dims.map((d) => {
            const c = toneColor(scoreTone(d.score));
            return (
              <div className="ds-checkup-dim" key={d.key}>
                <div className="ds-checkup-dim-top">
                  <span>{d.label}</span>
                  <strong style={{ color: c }}>{d.score}</strong>
                </div>
                <div className="ds-checkup-bar">
                  <i style={{ width: `${d.score}%`, background: c }} />
                </div>
                <div className="ds-checkup-dim-note">{d.note}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ds-checkup-scenes-title">逐镜诊断</div>
      <div className="ds-checkup-scenes">
        {report.scenes.map((s) => {
          const c = toneColor(scoreTone(s.score));
          return (
            <div className={`ds-checkup-scene ${s.isWeak ? "ds-checkup-scene--weak" : ""}`} key={s.index}>
              <div className="ds-checkup-scene-head">
                <span className="ds-checkup-scene-no">{s.index}</span>
                <span className="ds-checkup-scene-title">{s.title || ""}</span>
                <span className="ds-checkup-scene-score" style={{ color: c, borderColor: c }}>
                  {s.score}
                </span>
              </div>

              {s.issues.length ? (
                <ul className="ds-checkup-issues">
                  {s.issues.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              ) : (
                <p className="ds-checkup-ok">这一镜留人结构没问题 ✓</p>
              )}

              {s.issues.length ? (
                <div className="ds-checkup-scene-actions">
                  <Button size="sm" variant="ghost" onClick={() => handleJump(s.pos)}>
                    去编辑
                  </Button>
                  <Button size="sm" onClick={() => handleRewrite(s.pos)}>
                    重写本镜
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="ds-checkup-foot">
        「重写本镜」会调用 MiMo 只重写该镜（需已部署后端）；评分为启发式规则，最终以你的判断为准。
      </p>
    </Modal>
  );
}
