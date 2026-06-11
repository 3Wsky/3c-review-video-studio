import { PHASES } from "../core/constants.js";
import { useDirectorStore } from "../store/useDirectorStore.js";

export default function PhaseNav() {
  const phase = useDirectorStore((s) => s.phase);
  const setPhase = useDirectorStore((s) => s.setPhase);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav class="phase-nav" aria-label="工作流阶段">
      {PHASES.map((item) => (
        <button
          key={item.id}
          type="button"
          class={`phase-pill${phase === item.id ? " active" : ""}`}
          title={item.hint}
          onClick={() => {
            setPhase(item.id);
            if (item.id === "generate") scrollTo("stage-section");
            if (item.id === "editor") scrollTo("console-section");
            if (item.id === "quality") scrollTo("console-section");
            if (item.id === "deliver") scrollTo("console-section");
          }}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
