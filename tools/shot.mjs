#!/usr/bin/env node
// Скриншоты с настоящей эмуляцией вьюпорта (Edge headless зажимает минимум окна).
// node tools/shot.mjs <url> <width> <height> <out.png>
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

const [url = "http://127.0.0.1:5199/", width = "390", height = "844", out = "shot.png"] = process.argv.slice(2);
const PORT = 9334;
const BIN = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));
if (!BIN) throw new Error("нет Edge");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(BIN, [
  "--headless",
  "--disable-gpu",
  "--no-first-run",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP ?? "/tmp"}/dsh-shot-${Date.now()}`,
  "about:blank",
], { stdio: "ignore" });

let version = null;
for (let i = 0; i < 60 && !version; i++) {
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
await send("Emulation.setDeviceMetricsOverride", {
  width: Number(width),
  height: Number(height),
  deviceScaleFactor: 2,
  mobile: Number(width) < 760,
}, session);
await send("Page.navigate", { url }, session);
await sleep(2500);

// необязательный скрипт перед снимком (например, чтобы применить состояние)
const prelude = process.argv[6];
if (prelude) {
  await send("Runtime.enable", {}, session);
  await send("Runtime.evaluate", { expression: prelude, awaitPromise: true }, session);
  await sleep(1200);
}

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, session);
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log(`${out} (${width}×${height})`);
proc.kill();
process.exit(0);
