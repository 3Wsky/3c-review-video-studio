import { useEffect, useState } from "preact/hooks";
import { subscribeAppToast } from "../core/toast-bus.js";
import { Toast } from "./ui/Toast.jsx";

export default function GlobalToastHost() {
  const [toast, setToast] = useState(null);

  useEffect(() => subscribeAppToast((payload) => setToast(payload)), []);

  if (!toast) return null;

  return (
    <Toast
      message={toast.message}
      tone={toast.tone}
      duration={toast.duration}
      onClose={() => setToast(null)}
      className="global-toast-host"
    />
  );
}
