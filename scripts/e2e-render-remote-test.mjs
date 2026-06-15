import { readFile } from "node:fs/promises";

const url = process.argv[2] || "http://127.0.0.1:9234/render";
const payload = await readFile(new URL("./e2e-render-minimal.json", import.meta.url), "utf8");

console.log(`POST ${url}`);
const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: payload,
});

const ct = res.headers.get("content-type") || "";
console.log(`status=${res.status} type=${ct}`);

if (res.ok && ct.includes("video")) {
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`mp4_bytes=${buf.length}`);
} else {
  const text = await res.text();
  console.log(text.slice(0, 4000));
}
