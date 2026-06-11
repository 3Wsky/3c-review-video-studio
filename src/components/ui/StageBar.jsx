import { Panel } from "./Panel.jsx";
import { Button } from "./Button.jsx";
import { Input } from "./Field.jsx";

/** @param {{ productName: string; inputId?: string; onProductNameChange: (v: string) => void; onGenerate: () => void; onToggleAdvanced?: () => void; advancedOpen?: boolean; hint?: string; busy?: boolean; generateLabel?: string; children?: import('preact').ComponentChildren }} props */
export function StageBar({
  productName,
  inputId,
  onProductNameChange,
  onGenerate,
  onToggleAdvanced,
  advancedOpen = false,
  hint,
  busy = false,
  generateLabel = "一键生成",
  children
}) {
  return (
    <Panel stage className="ds-stage-bar">
      <div className="ds-cue-row">
        <Input
          id={inputId}
          fieldSize="cue"
          type="text"
          value={productName}
          placeholder="输入产品名，例如：华为Nova16"
          onInput={(e) => onProductNameChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onGenerate();
            }
          }}
          aria-label="产品名"
        />
        <Button variant="primary" size="lg" busy={busy} onClick={onGenerate}>
          {generateLabel}
        </Button>
        {onToggleAdvanced ? (
          <Button
            size="lg"
            className={advancedOpen ? "ds-btn--active" : ""}
            aria-expanded={advancedOpen}
            onClick={onToggleAdvanced}
          >
            高级设置
          </Button>
        ) : null}
      </div>
      {hint ? <p className="ds-cue-hint">{hint}</p> : null}
      {children}
    </Panel>
  );
}
