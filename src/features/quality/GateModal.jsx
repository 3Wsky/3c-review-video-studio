import { Modal, Button } from "../../components/ui/index.js";
import { GATE_TONE, GATE_LABEL } from "./score-utils.js";

/**
 * @param {{
 *   open: boolean;
 *   report: import('./quality-types.js').GateReport | null;
 *   allowProceed: boolean;
 *   onClose: () => void;
 *   onProceed?: () => void;
 * }} props
 */
export function GateModal({ open, report, allowProceed, onClose, onProceed }) {
  if (!open || !report) return null;

  const passTone = report.pass ? GATE_TONE.pass : GATE_TONE.fail;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="防垃圾质检闸门"
      subtitle="出片前三道闸门：留人体检 · 事实溯源 · 反洗稿。不达标会拦下，可人工放行。"
      size="lg"
      className="ds-gate-modal"
      actions={
        allowProceed ? (
          <>
            <Button size="sm" variant="ghost" onClick={onClose}>
              去修改
            </Button>
            <Button size="sm" onClick={onProceed}>
              仍要渲染
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onClose}>
            知道了
          </Button>
        )
      }
    >
      <div className="ds-gate-verdict" style={{ borderColor: passTone, color: passTone }}>
        <strong>
          {report.pass ? "三道闸门全部通过，可以渲染" : "有闸门未通过，建议先修改再渲染"}
        </strong>
      </div>

      <div className="ds-gate-checks">
        {report.checks.map((c) => {
          const tone = GATE_TONE[c.status] || GATE_TONE.warn;
          return (
            <div className={`ds-gate-check ds-gate-check--${c.status}`} key={c.key}>
              <div className="ds-gate-check-head">
                <span className="ds-gate-check-label">{c.label}</span>
                <span className="ds-gate-check-tag" style={{ color: tone, borderColor: tone }}>
                  {GATE_LABEL[c.status] || GATE_LABEL.warn}
                </span>
              </div>
              <p className="ds-gate-check-summary">{c.summary}</p>
              {c.detail?.length ? (
                <ul className="ds-gate-detail">
                  {c.detail.slice(0, 8).map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
