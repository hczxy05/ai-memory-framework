import assert from "node:assert/strict";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
const SERVER_PATH=path.join(import.meta.dirname,"server.mjs");
export function createDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE l1_records (
      record_id TEXT PRIMARY KEY, content TEXT NOT NULL, type TEXT DEFAULT '', priority INTEGER DEFAULT 50,
      scene_name TEXT DEFAULT '', session_key TEXT DEFAULT '', session_id TEXT DEFAULT '', timestamp_str TEXT DEFAULT '',
      timestamp_start TEXT DEFAULT '', timestamp_end TEXT DEFAULT '', created_time TEXT DEFAULT '', updated_time TEXT DEFAULT '',
      metadata_json TEXT DEFAULT '{}'
    );
    CREATE VIRTUAL TABLE l1_fts USING fts5(
      content, content_original UNINDEXED, record_id UNINDEXED, type UNINDEXED, priority UNINDEXED,
      scene_name UNINDEXED, session_key UNINDEXED, session_id UNINDEXED, timestamp_str UNINDEXED,
      timestamp_start UNINDEXED, timestamp_end UNINDEXED, metadata_json UNINDEXED
    );
    CREATE TABLE l0_conversations (
      record_id TEXT PRIMARY KEY, session_key TEXT NOT NULL, session_id TEXT DEFAULT '', role TEXT NOT NULL DEFAULT '',
      message_text TEXT NOT NULL, recorded_at TEXT DEFAULT '', timestamp INTEGER DEFAULT 0
    );
    CREATE VIRTUAL TABLE l0_fts USING fts5(
      message_text, message_text_original UNINDEXED, record_id UNINDEXED, session_key UNINDEXED,
      session_id UNINDEXED, role UNINDEXED, recorded_at UNINDEXED, timestamp UNINDEXED
    );
  `);

  return db;
}
export function startServer(dataDir, overrides = {}) {
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", SERVER_PATH], {
    env: { ...process.env, TDAI_DATA_DIR: dataDir, TDAI_SESSION_KEY: "fixture", TDAI_ALLOW_STORE: "true", ...overrides },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map();
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.once("exit", () => {
    for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error("MCP exited before replying")); }
    pending.clear();
  });
  lines.on("line", (line) => {
    const response = JSON.parse(line);
    const key = response.id === null ? pending.keys().next().value : response.id;
    const waiter = pending.get(key);
    if (waiter) { clearTimeout(waiter.timer); pending.delete(key); waiter.resolve(response); }
  });
  return {
    request(message) {
      return new Promise((resolve, reject) => {
        assert.ok(!pending.has(message.id), "test requests must have unique pending ids");
        const timer = setTimeout(() => { pending.delete(message.id); reject(new Error("MCP request timed out")); child.kill(); }, 15000);
        pending.set(message.id, { resolve, reject, timer });
        child.stdin.write(JSON.stringify(message) + "\n");
      });
    },
    async close() {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.stdin.end();
        await exited;
      }
      assert.equal(stderr.trim(), "", "server should produce no stderr output");
    },
  };
}

export function toolCall(client, id, name, args) {
  return client.request({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
}

