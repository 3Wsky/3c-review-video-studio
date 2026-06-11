import { useEffect } from "preact/hooks";
import { StageBar } from "../../components/ui/index.js";
import { useDirectorStore } from "../../store/useDirectorStore.js";
import { triggerLegacyGenerate } from "../../legacy/store-bridge.js";
import AdvancedSettings from "./AdvancedSettings.jsx";

export default function GeneratePanel() {
  const productName = useDirectorStore((s) => s.productName);
  const cueHint = useDirectorStore((s) => s.cueHint);
  const advancedOpen = useDirectorStore((s) => s.advancedOpen);
  const setField = useDirectorStore((s) => s.setField);
  const busy = useDirectorStore((s) => s.busy);

  useEffect(() => {
    const panel = document.getElementById("advPanel");
    if (panel) panel.hidden = !advancedOpen;
  }, [advancedOpen]);

  return (
    <section class="stage-bar" id="stage-section">
      <StageBar
        productName={productName}
        onProductNameChange={(v) => setField("productName", v)}
        inputId="productName"
        onGenerate={() => triggerLegacyGenerate()}
        onToggleAdvanced={() => setField("advancedOpen", !advancedOpen)}
        advancedOpen={advancedOpen}
        hint={cueHint}
        busy={busy}
      >
        <AdvancedSettings />
      </StageBar>
      {/* legacy director 仍读取此 hint 节点 */}
      <p class="cue-hint" id="cueHint" hidden>
        {cueHint}
      </p>
      <button id="oneClickBtn" type="button" hidden aria-hidden="true" />
      <button id="advToggle" type="button" hidden aria-hidden="true" />
    </section>
  );
}
