import { useDirectorStore } from "../../store/useDirectorStore.js";
import { CheckupModal } from "./CheckupModal.jsx";
import { GateModal } from "./GateModal.jsx";
import { proceedGate } from "./quality-bridge.js";

export default function QualityOverlays() {
  const checkupOpen = useDirectorStore((s) => s.checkupOpen);
  const checkupReport = useDirectorStore((s) => s.checkupReport);
  const gateOpen = useDirectorStore((s) => s.gateOpen);
  const gateReport = useDirectorStore((s) => s.gateReport);
  const gateAllowProceed = useDirectorStore((s) => s.gateAllowProceed);
  const closeCheckup = useDirectorStore((s) => s.closeCheckup);
  const closeGate = useDirectorStore((s) => s.closeGate);

  return (
    <>
      <CheckupModal open={checkupOpen} report={checkupReport} onClose={closeCheckup} />
      <GateModal
        open={gateOpen}
        report={gateReport}
        allowProceed={gateAllowProceed}
        onClose={closeGate}
        onProceed={proceedGate}
      />
    </>
  );
}
