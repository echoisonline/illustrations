#!/usr/bin/env node
// Снимает композиции по-настоящему: гоняет приложение и вырезает только холст.
// node tools/scenes.mjs [outDir]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const OUT = process.argv[2] ?? "docs/scenes";
const URL = "http://127.0.0.1:5199/";
const PORT = 9337;
const BIN = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));
if (!BIN) throw new Error("нет Edge");

const CASES = [
  ["знание", "обучение и курсы"],
  ["деньги", "деньги и бюджет"],
  ["идея", "идея и вдохновение"],
  ["порядок", "порядок в процессах"],
];

const FORMATS = [
  ["square", 1000, 1000],
  ["wide", 1200, 630],
  ["tall", 800, 1200],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const proc = spawn(BIN, [
  "--headless",
  "--disable-gpu",
  "--no-first-run",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP ?? "/tmp"}/dsh-scenes-${Date.now()}`,
  "about:blank",
], { stdio: "ignore" });

let version = null;
for (let i = 0; i < 80 && !version; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (res.ok) version = await res.json();
  } catch {
    await sleep(200);
  }
}
if (!version) throw new Error("браузер не поднялся");

const socket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

let id = 0;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    socket.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

const target = await send("Target.createTarget", { url: "about:blank" });
const attached = await send("Target.attachToTarget", { targetId: target.result.targetId, flatten: true });
const session = attached.result.sessionId;

await send("Page.enable", {}, session);
await send("Runtime.enable", {}, session);
await send("Emulation.setDeviceMetricsOverride", {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
}, session);
await send("Page.navigate", { url: URL }, session);
await sleep(3000);

const until = async (expression, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true }, session);
    if (result.result?.result?.value) return result.result.result.value;
    await sleep(150);
  }
  return null;
};

await until("!!window.__store");

for (const [slug, theme] of CASES) {
  for (const [format, w] of FORMATS) {
    await send("Runtime.evaluate", {
      expression: `(() => { const s = window.__store.getState(); s.run(${JSON.stringify(theme)}); s.setFormat(${JSON.stringify(format)}); return 1; })()`,
      returnByValue: true,
    }, session);
    await sleep(300);
    const rect = await send("Runtime.evaluate", {
      expression: `(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`,
      returnByValue: true,
    }, session);
    const box = rect.result.result.value;
    const shot = await send("Page.captureScreenshot", {
      format: "png",
      clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: w / box.w },
      captureBeyondViewport: true,
    }, session);
    const file = `${OUT}/${slug}-${format}.png`;
    writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    console.log(`${file}  ${w}px`);
  }
}

proc.kill();
process.exit(0);
