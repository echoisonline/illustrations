#!/usr/bin/env node
// Печатает ошибки страницы: node tools/errors.mjs [url]
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const url = process.argv[2] ?? "http://127.0.0.1:5199/";
const PORT = 9340;
const BIN = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((path) => existsSync(path));
if (!BIN) throw new Error("нет Edge");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const proc = spawn(BIN, [
  "--headless",
  "--disable-gpu",
  "--no-first-run",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP ?? "/tmp"}/errors-${Date.now()}`,
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

const messages = [];
let id = 0;
const pending = new Map();
const send = (method, params = {}, sessionId) =>
  new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    socket.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    const detail = message.params.exceptionDetails;
    messages.push(`${detail.text} ${detail.exception?.description ?? ""}`.trim());
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    messages.push(message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
  }
};

const target = await send("Target.createTarget", { url: "about:blank" });
const attached = await send("Target.attachToTarget", { targetId: target.result.targetId, flatten: true });
const session = attached.result.sessionId;
await send("Runtime.enable", {}, session);
await send("Page.enable", {}, session);
await send("Page.navigate", { url }, session);
await sleep(3000);

const body = await send("Runtime.evaluate", { expression: "document.body.innerHTML.length", returnByValue: true }, session);
console.log("длина body:", body.result?.result?.value);
console.log(messages.length ? messages.join("\n---\n") : "ошибок нет");
proc.kill();
process.exit(0);
