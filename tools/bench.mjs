#!/usr/bin/env node
// Стенд визуального тестирования: рендерит ВСЕ кандидаты одной темы.
// node tools/bench.mjs "обучение и курсы" [square|wide|tall]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const [theme = "обучение и курсы", format = "square"] = process.argv.slice(2);
const OUT = "docs/bench";
const PORT = 9347;
const BIN = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));
if (!BIN) throw new Error("нет Edge");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const proc = spawn(BIN, ["--headless", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}/dsh-bench-${Date.now()}`, "about:blank"], { stdio: "ignore" });

let version = null;
for (let i = 0; i < 80 && !version; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (res.ok) version = await res.json();
  } catch { await sleep(200); }
}
if (!version) throw new Error("браузер не поднялся");

const socket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { socket.onopen = res; socket.onerror = rej; });
let id = 0;
const pending = new Map();
socket.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((resolve) => {
  const mid = ++id; pending.set(mid, resolve);
  socket.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const target = await send("Target.createTarget", { url: "about:blank" });
const attached = await send("Target.attachToTarget", { targetId: target.result.targetId, flatten: true });
const session = attached.result.sessionId;
await send("Page.enable", {}, session);
await send("Runtime.enable", {}, session);
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false }, session);
await send("Page.navigate", { url: "http://127.0.0.1:5199/" }, session);
await sleep(3000);

const run = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, session);
  return r.result?.result?.value;
};

await run(`(() => { const s = window.__store.getState(); s.setFormat(${JSON.stringify(format)}); s.run(${JSON.stringify(theme)}); return 1; })()`);
await sleep(500);

const list = JSON.parse(await run("JSON.stringify(window.__candidates())"));
const meta = list.map((c, index) => ({ index, pattern: c.pattern, mirror: c.mirror, facet: c.facet, ok: c.ok, score: c.score, violations: c.violations }));

for (const [index] of list.entries()) {
  await run(`(() => { const s = window.__store.getState(); const c = window.__candidates()[${index}]; window.__store.setState({ items: c.items, selected: null }); return 1; })()`);
  await sleep(250);
  const rect = await run(`(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  const box = JSON.parse(JSON.stringify(rect));
  const width = format === "wide" ? 1200 : format === "tall" ? 800 : 1000;
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: width / box.w },
    captureBeyondViewport: true,
  }, session);
  writeFileSync(`${OUT}/${String(index).padStart(2, "0")}.png`, Buffer.from(shot.result.data, "base64"));
}

writeFileSync(`${OUT}/meta.json`, JSON.stringify({ theme, format, candidates: meta }, null, 2));
console.log(`${list.length} кандидатов в ${OUT}`);
for (const c of meta) console.log(` ${c.ok ? "ok " : "no "} ${c.pattern.padEnd(16)} ${c.facet.padEnd(10)} ${c.score}  ${c.violations.join(", ")}`);

proc.kill();
process.exit(0);
