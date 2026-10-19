import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Peak Flash pricing was 2 RMB/M input and 8 RMB/M output on 2026-10-16.
// Reserve 10 RMB/M for UTF-8 request bytes + 16384 overhead tokens + 2048 output.
export function createBudgetProxy({ ledgerFile, readKey, forward, limits = { maxCalls: 12, maxReservedRmb: 4 } }) {
  if (!Number.isInteger(limits.maxCalls) || limits.maxCalls < 1 || limits.maxCalls > 1000 ||
      !Number.isFinite(limits.maxReservedRmb) || limits.maxReservedRmb <= 0 || limits.maxReservedRmb > 90) throw new Error("Invalid budget policy; maximum reservation is 90 RMB");
  const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, "utf8")) :
    { calls: 0, reservedRmb: 0, expiresAt: Date.now() + 24 * 3600_000, usage: [] };
  if (!Number.isFinite(ledger.reservedRmb) || ledger.reservedRmb < 0 || !Number.isInteger(ledger.calls) || ledger.calls < 0 || !Number.isFinite(ledger.expiresAt) || !Array.isArray(ledger.usage)) throw new Error("Invalid budget ledger");
  const lockFile = ledgerFile + ".lock";
  const lock = fs.openSync(lockFile, "wx", 0o600);
  const server = http.createServer(async (req, res) => {
    const reply = (status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
    if (req.method === "GET" && req.url === "/health") return reply(200, { ready: Boolean(readKey()), calls: ledger.calls, reservedRmb: ledger.reservedRmb, expiresAt: ledger.expiresAt, limits, completed: ledger.usage.length });
    if (req.method !== "POST" || !["/v1/chat/completions", "/chat/completions"].includes(req.url)) return reply(404, { error: "Unsupported endpoint" });
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 131072) return reply(413, { error: "Request too large" }); chunks.push(chunk); }
      const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!Array.isArray(input.messages) || !input.messages.length || input.model !== "deepseek-flash") return reply(400, { error: "Only deepseek-flash chat messages are allowed" });
      const fields = new Set(["role", "content", "name", "tool_call_id", "tool_calls", "reasoning_content", "prefix"]);
      const textOnly = input.messages.every((m) => m && typeof m === "object" && !Array.isArray(m) && Object.keys(m).every((k) => fields.has(k)) &&
        (m.content == null || typeof m.content === "string" || (Array.isArray(m.content) && m.content.every((p) => p?.type === "text" && typeof p.text === "string"))) &&
        (m.tool_calls == null || (Array.isArray(m.tool_calls) && m.tool_calls.every((c) => c?.type === "function"))));
      const functionsOnly = input.tools == null || (Array.isArray(input.tools) && input.tools.every((t) => t?.type === "function" && t.function && typeof t.function === "object"));
      // Remote media and hosted tools can incur charges unrelated to request text size.
      if (!textOnly || !functionsOnly) return reply(400, { error: "Text-only messages and client function tools are required" });
      const key = readKey();
      if (!key) return reply(503, { error: "Model key has not been configured" });
      const payload = { model: "deepseek-flash", messages: input.messages, max_tokens: 2048,
        stream: false, thinking: { type: "disabled" }, ...(input.tools ? { tools: input.tools } : {}),
        ...(input.tool_choice ? { tool_choice: input.tool_choice } : {}), ...(input.response_format ? { response_format: input.response_format } : {}) };
      const reserve = (Buffer.byteLength(JSON.stringify(payload)) + 16384 + 2048) * 10 / 1e6;
      if (ledger.calls >= limits.maxCalls || ledger.reservedRmb + reserve > limits.maxReservedRmb || Date.now() >= ledger.expiresAt) return reply(429, { error: "Test budget exhausted or expired" });
      // Reserve before awaiting I/O; failures also consume budget and retries remain bounded.
      ledger.calls++; ledger.reservedRmb += reserve;
      fs.writeFileSync(ledgerFile, JSON.stringify(ledger), { mode: 0o600 });
      const output = await forward(payload, key);
      ledger.usage.push(output.usage || {});
      fs.writeFileSync(ledgerFile, JSON.stringify(ledger), { mode: 0o600 });
      if (!input.stream) return reply(200, output);
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      const base = { id: output.id, object: "chat.completion.chunk", created: output.created, model: output.model };
      const choice = output.choices[0], delta = { ...choice.message };
      if (delta.tool_calls) delta.tool_calls = delta.tool_calls.map((call, index) => ({ ...call, index }));
      res.write("data: " + JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason: null }] }) + "\n\n");
      res.write("data: " + JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: choice.finish_reason || "stop" }], usage: output.usage }) + "\n\n");
      res.end("data: [DONE]\n\n");
    } catch { if (!res.headersSent) reply(502, { error: "Model request failed; details withheld to protect credentials" }); else res.end(); }
  });
  server.once("close", () => { fs.closeSync(lock); fs.unlinkSync(lockFile); });
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createBudgetProxy({
    ledgerFile: "/private/state/budget.json",
    limits: fs.existsSync("/private/budget-policy.json") ? JSON.parse(fs.readFileSync("/private/budget-policy.json", "utf8")) : undefined,
    readKey: () => { try { return fs.readFileSync("/private/deepseek.key", "utf8").trim(); } catch { return ""; } },
    forward: async (payload, key) => {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST", headers: { authorization: "Bearer " + key, "content-type": "application/json" },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) throw new Error("Upstream request rejected");
      return response.json();
    },
  });
  server.listen(8080, "0.0.0.0", () => console.log("Budget proxy ready; no key is printed"));
  process.once("SIGTERM", () => server.close(() => process.exit(0)));
}
