import { render } from "preact";
import App from "./App.jsx";
import "../styles.css";

render(<App />, document.getElementById("app"));

import("./legacy/boot.js").then((m) => m.bootDirectorApp());
