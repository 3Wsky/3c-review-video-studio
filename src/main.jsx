import { render } from "preact";
import App from "./App.jsx";
import "./design/index.css";
import "./styles/tokens.css";
import "../styles.css";

render(<App />, document.getElementById("app"));

import("./legacy/boot.js").then((m) => m.bootDirectorApp());
