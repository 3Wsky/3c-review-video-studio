import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const payload = JSON.parse(
  await readFile(new URL("./e2e-render-minimal.json", import.meta.url), "utf8"),
);

const worker = spawn("node", ["worker.mjs"], {
  cwd: new URL("../video-render/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: "9235" },
});

let ready = false;
worker.stdout.on("data", (d) => {
  const s = d.toString();
  process.stderr.write(s);
  if (s.includes("监听")) ready = true;
});
worker.stderr.on("data", (d) => process.stderr.write(d.toString()));

await new Promise((r) => setTimeout(r, 2000));

const res = await fetch("http://127.0.0.1:9235/render", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});

const ct = res.headers.get("content-type") || "";
process.stdout.write(`status=${res.status} type=${ct}\n`);

if (res.ok && ct.includes("video")) {
  const buf = Buffer.from(await res.arrayBuffer());
  process.stdout.write(`mp4_bytes=${buf.length}\n`);
} else {
  process.stdout.write(await res.text());
}

worker.kill();
