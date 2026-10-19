import { createDatabase, startServer, toolCall } from "./test-support.mjs";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const SERVER_PATH = path.join(import.meta.dirname, "server.mjs");

function createFixture() {
  const dataDir = mkdtempSync(path.join(import.meta.dirname, "tdai-test-"));
  const dbPath = path.join(dataDir, "vectors.db");
  const db = createDatabase(dbPath);
  const insertL1 = db.prepare(`INSERT INTO l1_records (
    record_id, content, type, priority, scene_name, session_key, session_id, timestamp_str,
    timestamp_start, timestamp_end, created_time, updated_time, metadata_json
  ) VALUES (?, ?, ?, ?, ?, 'fixture', 'fixture', ?, ?, ?, ?, ?, '{}')`);
  const insertL1Fts = db.prepare(`INSERT INTO l1_fts (
    content, content_original, record_id, type, priority, scene_name, session_key, session_id,
    timestamp_str, timestamp_start, timestamp_end, metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, 'fixture', 'fixture', ?, ?, ?, '{}')`);
  const insertL0 = db.prepare("INSERT INTO l0_conversations VALUES (?, 'fixture', 'fixture', 'user', ?, ?, ?)");
  const insertL0Fts = db.prepare("INSERT INTO l0_fts VALUES (?, ?, ?, 'fixture', 'fixture', 'user', ?, ?)");

  function addL1(id, content, scene, stamp, type = "episodic", priority = 60) {
    insertL1.run(id, content, type, priority, scene, stamp, stamp, stamp, stamp, stamp);
    insertL1Fts.run(content, content, id, type, priority, scene, stamp, stamp, stamp);
  }

  function addL0(id, content, stamp, timestamp) {
    insertL0.run(id, content, stamp, timestamp);
    insertL0Fts.run(content, content, id, stamp, timestamp);
  }

  addL1("seed-memory", "SCARA STM32 test memory", "fixture", "2026-01-01");
  addL0("seed-conversation", "SCARA STM32 test conversation", "2026-01-01", 1);
  addL1("old-exact-memory", "alpha beta", "ranking fixture", "2020-01-01");
  addL0("old-exact-conversation", "alpha beta", "2020-01-01", 0);
  addL1("global-instruction", "global coding rule required", "priority fixture", "2020-01-01", "instruction", -1);
  addL1("ordinary-instruction", "global coding rule optional", "priority fixture", "2026-01-01", "instruction", 100);

  for (let index = 0; index < 101; index++) {
    const stamp = `2026-01-01T00:${String(index).padStart(3, "0")}:00Z`;
    addL1(`recent-partial-memory-${index}`, `alpha filler ${index}`, "ranking fixture", stamp);
    addL0(`recent-partial-conversation-${index}`, `alpha filler ${index}`, stamp, index + 100);
  }
  db.close();
  return { dataDir, dbPath };
}

const ADMISSION = { user_authorized: true, confirmed: true, stable: true, reusable: true };

// ── Tests ────────────────────────────────────────────────────────────────────

test("initialize returns correct protocol version and server info", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const init = await client.request({
      jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1900-01-01" },
    });
    assert.equal(init.result.protocolVersion, "2025-03-26");
    assert.equal(init.result.serverInfo.name, "tdai-memory-local");
    assert.equal(init.result.serverInfo.version, "1.1.0");
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("tools/list returns all 4 tools", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const list = await client.request({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const names = list.result.tools.map((t) => t.name);
    assert.ok(names.includes("tdai_memory_search"));
    assert.ok(names.includes("tdai_conversation_search"));
    assert.ok(names.includes("tdai_read_cos"));
    assert.ok(names.includes("tdai_experience_store"));
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("tdai_memory_search returns real results from SQLite", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const res = await toolCall(client, 3, "tdai_memory_search", { query: "SCARA STM32", limit: 3 });
    assert.ok(res.result.structuredContent.results.length > 0, "should return results");
    assert.equal(res.result.structuredContent.results[0].id, "seed-memory");
    assert.equal(res.result.structuredContent.retrieval, "fts5");
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("tdai_conversation_search returns real results from SQLite", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const res = await toolCall(client, 4, "tdai_conversation_search", { query: "SCARA STM32", limit: 3 });
    assert.ok(res.result.structuredContent.results.length > 0, "should return results");
    assert.equal(res.result.structuredContent.results[0].id, "seed-conversation");
    assert.equal(res.result.structuredContent.retrieval, "fts5");
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("search ranking: exact match scores higher", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const mem = await toolCall(client, 5, "tdai_memory_search", { query: "alpha beta", limit: 3 });
    assert.equal(mem.result.structuredContent.results[0].id, "old-exact-memory");

    const conv = await toolCall(client, 6, "tdai_conversation_search", { query: "alpha beta", limit: 3 });
    assert.equal(conv.result.structuredContent.results[0].id, "old-exact-conversation");
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("priority -1 (global instruction) gets a boost", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const res = await toolCall(client, 12, "tdai_memory_search", { query: "global coding rule", limit: 3 });
    assert.equal(res.result.structuredContent.results[0].id, "global-instruction");
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("tdai_experience_store rejects without authorization flags", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const res = await toolCall(client, 7, "tdai_experience_store", { content: "Confirmed reusable test memory." });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /must all be true/);
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("tdai_experience_store rejects sensitive content", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const admission = { user_authorized: true, confirmed: true, stable: true, reusable: true };
    const res = await toolCall(client, 8, "tdai_experience_store", {
      ...admission,
      content: "Fake github_pat_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA must never persist.",
    });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /credential or secret/);
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("tdai_experience_store rejects sensitive scene_name", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const admission = { user_authorized: true, confirmed: true, stable: true, reusable: true };
    const res = await toolCall(client, 9, "tdai_experience_store", {
      ...admission,
      content: "This otherwise safe reusable memory has enough text.",
      scene_name: "password=abcdefghijk",
    });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /credential or secret/);
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("tdai_experience_store stores valid experience and detects duplicates", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const admission = { user_authorized: true, confirmed: true, stable: true, reusable: true };
    const valid = {
      ...admission,
      content: "Confirmed stable reusable integration fixture memory.",
      scene_name: "integration fixture",
    };
    const stored = await toolCall(client, 10, "tdai_experience_store", valid);
    assert.equal(stored.result.structuredContent.stored, true);

    const duplicate = await toolCall(client, 11, "tdai_experience_store", valid);
    assert.equal(duplicate.result.structuredContent.duplicate, true);

    const verify = new DatabaseSync(fixture.dbPath, { readOnly: true });
    assert.equal(verify.prepare("SELECT COUNT(*) AS n FROM l1_records WHERE scene_name = 'integration fixture'").get().n, 1);
    assert.equal(verify.prepare("SELECT COUNT(*) AS n FROM l1_fts WHERE scene_name = 'integration fixture'").get().n, 1);
    verify.close();
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("tdai_read_cos rejects absolute paths", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const res = await toolCall(client, 20, "tdai_read_cos", { path: "/etc/passwd" });
    assert.equal(res.result.isError, true);
    assert.ok(res.result.content[0].text.includes("Access denied"));
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("tdai_read_cos rejects '..' traversal", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const res = await toolCall(client, 21, "tdai_read_cos", { path: "../../../etc/passwd" });
    assert.equal(res.result.isError, true);
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("writes are hidden and rejected by default even with all admission flags", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir, { TDAI_ALLOW_STORE: undefined });
  try {
    const list = await client.request({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    assert.equal(list.result.tools.length, 3);
    assert.ok(!list.result.tools.some((tool) => tool.name === "tdai_experience_store"));
    const res = await toolCall(client, 2, "tdai_experience_store", { ...ADMISSION, content: "Confirmed reusable test memory." });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /host must enable/);
    const db = new DatabaseSync(fixture.dbPath, { readOnly: true });
    assert.equal(db.prepare("SELECT count(*) AS n FROM l1_records WHERE content = ?").get("Confirmed reusable test memory.").n, 0);
    db.close();
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("truthy non-boolean admission flags cannot authorize writes", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    for (const flag of Object.keys(ADMISSION)) {
      const res = await toolCall(client, 1, "tdai_experience_store", { ...ADMISSION, [flag]: "true", content: "Confirmed reusable test memory." });
      assert.equal(res.result.isError, true);
      assert.match(res.result.content[0].text, /must all be true/);
    }
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("search and store fail closed without a host-configured scope", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir, { TDAI_SESSION_KEY: "" });
  try {
    for (const name of ["tdai_memory_search", "tdai_conversation_search", "tdai_experience_store"]) {
      const res = await toolCall(client, 1, name, { query: "SCARA", ...ADMISSION, content: "Confirmed reusable test memory." });
      assert.equal(res.result.isError, true);
      assert.match(res.result.content[0].text, /TDAI_SESSION_KEY/);
    }
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

for (const fallback of [false, true]) {
  test(`searches and deduplication respect host scope (${fallback ? "LIKE" : "FTS5"})`, async () => {
    const fixture = createFixture();
    if (fallback) {
      const db = new DatabaseSync(fixture.dbPath);
      db.exec("DROP TABLE l1_fts; DROP TABLE l0_fts");
      db.close();
    }
    const client = startServer(fixture.dataDir, { TDAI_SESSION_KEY: "other-user:other-project:other-agent" });
    try {
      for (const name of ["tdai_memory_search", "tdai_conversation_search"]) {
        const res = await toolCall(client, 1, name, { query: "SCARA STM32", session_key: "fixture" });
        assert.deepEqual(res.result.structuredContent.results, []);
      }
      const scene = await toolCall(client, 1, "tdai_memory_search", { query: "ranking fixture" });
      assert.deepEqual(scene.result.structuredContent.results, [], "scene-only matches must also stay inside the scope");
      if (!fallback) {
        const stored = await toolCall(client, 2, "tdai_experience_store", { ...ADMISSION, content: "SCARA STM32 test memory" });
        assert.equal(stored.result.structuredContent.stored, true, "another scope must not suppress the write as a duplicate");
        const res = await toolCall(client, 3, "tdai_memory_search", { query: "SCARA STM32" });
        assert.equal(res.result.structuredContent.results.length, 1);
        assert.equal(res.result.structuredContent.results[0].id, stored.result.structuredContent.id);
        assert.equal(res.result.structuredContent.results[0].session_key, "other-user:other-project:other-agent");
      }
    } finally {
      await client.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
    }
  });
}

test("bounded LIKE fallback preserves older exact matches and clamps result counts", async () => {
  const fixture = createFixture();
  const db = new DatabaseSync(fixture.dbPath);
  db.exec("DROP TABLE l1_fts; DROP TABLE l0_fts");
  db.close();
  const client = startServer(fixture.dataDir);
  try {
    for (const [name, expected] of [["tdai_memory_search", "old-exact-memory"], ["tdai_conversation_search", "old-exact-conversation"]]) {
      const res = await toolCall(client, 1, name, { query: "alpha beta", limit: 10000 });
      assert.equal(res.result.structuredContent.retrieval, "like");
      assert.equal(res.result.structuredContent.results[0].id, expected);
      assert.equal(res.result.structuredContent.results.length, 3);
    }
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("new writes distinguish process sessions within the same host scope", async () => {
  const fixture = createFixture();
  const sessions = [];
  try {
    for (let index = 0; index < 2; index++) {
      const client = startServer(fixture.dataDir);
      try {
        const res = await toolCall(client, 1, "tdai_experience_store", {
          ...ADMISSION, content: `Confirmed stable session regression memory ${index}.`,
        });
        assert.equal(res.result.structuredContent.stored, true);
        const db = new DatabaseSync(fixture.dbPath, { readOnly: true });
        const row = db.prepare("SELECT session_key, session_id FROM l1_records WHERE record_id = ?").get(res.result.structuredContent.id);
        assert.equal(row.session_key, "fixture");
        assert.ok(row.session_id);
        sessions.push(row.session_id);
        db.close();
      } finally {
        await client.close();
      }
    }
    assert.notEqual(sessions[0], sessions[1]);
  } finally {
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("failed FTS insertion rolls back the L1 write", async () => {
  const fixture = createFixture();
  const db = new DatabaseSync(fixture.dbPath);
  db.exec("DROP TABLE l1_fts");
  db.close();
  const client = startServer(fixture.dataDir);
  try {
    const content = "Confirmed transaction rollback regression fixture.";
    const res = await toolCall(client, 1, "tdai_experience_store", { ...ADMISSION, content });
    assert.equal(res.result.isError, true);
    const verify = new DatabaseSync(fixture.dbPath, { readOnly: true });
    assert.equal(verify.prepare("SELECT count(*) AS n FROM l1_records WHERE content = ?").get(content).n, 0);
    verify.close();
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("read_cos permits bounded Markdown and denies metadata, databases, directories and oversized UTF-8", async () => {
  const fixture = createFixture();
  mkdirSync(path.join(fixture.dataDir, "scene_blocks", "nested"), { recursive: true });
  mkdirSync(path.join(fixture.dataDir, "scene_blocks", "directory.md"));
  mkdirSync(path.join(fixture.dataDir, ".metadata"));
  writeFileSync(path.join(fixture.dataDir, "persona.md"), "Historical persona 画像");
  writeFileSync(path.join(fixture.dataDir, "scene_blocks", "nested", "valid.md"), "x".repeat(64 * 1024));
  writeFileSync(path.join(fixture.dataDir, "scene_blocks", "large.md"), "中".repeat(22000));
  writeFileSync(path.join(fixture.dataDir, "scene_blocks", "large-ascii.md"), "x".repeat(64 * 1024 + 1));
  writeFileSync(path.join(fixture.dataDir, ".metadata", "secret.md"), "must not be disclosed");
  const client = startServer(fixture.dataDir);
  try {
    for (const file of ["persona.md", "scene_blocks/nested/valid.md"]) {
      const res = await toolCall(client, 1, "tdai_read_cos", { path: file });
      assert.ok(!res.result.isError, res.result.content[0].text);
      assert.match(res.result.content[0].text, /authority="historical-evidence"/);
    }
    for (const file of ["vectors.db", ".metadata/secret.md", "scene_blocks/directory.md", "scene_blocks/nested/valid.md:secret", "scene_blocks/large.md", "scene_blocks/large-ascii.md"]) {
      const res = await toolCall(client, 1, "tdai_read_cos", { path: file });
      assert.equal(res.result.isError, true, file);
      assert.match(res.result.content[0].text, /Access denied|64 KiB/);
    }
    const missing = await toolCall(client, 1, "tdai_read_cos", { path: "scene_blocks/missing.md" });
    assert.equal(missing.result.isError, true);
    assert.match(missing.result.content[0].text, /File not found/);
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("read_cos blocks directory symlink/junction escapes and metadata aliases", async () => {
  const fixture = createFixture();
  const outside = mkdtempSync(path.join(import.meta.dirname, "tdai-test-outside-"));
  mkdirSync(path.join(fixture.dataDir, "scene_blocks"));
  mkdirSync(path.join(fixture.dataDir, ".metadata"));
  writeFileSync(path.join(outside, "secret.md"), "outside secret must not be disclosed");
  writeFileSync(path.join(fixture.dataDir, ".metadata", "secret.md"), "metadata secret must not be disclosed");
  symlinkSync(outside, path.join(fixture.dataDir, "scene_blocks", "escape"), process.platform === "win32" ? "junction" : "dir");
  symlinkSync(path.join(fixture.dataDir, ".metadata"), path.join(fixture.dataDir, "scene_blocks", "alias"), process.platform === "win32" ? "junction" : "dir");
  const client = startServer(fixture.dataDir);
  try {
    for (const file of ["scene_blocks/escape/secret.md", "scene_blocks/alias/secret.md"]) {
      const res = await toolCall(client, 1, "tdai_read_cos", { path: file });
      assert.equal(res.result.isError, true);
      assert.match(res.result.content[0].text, /Access denied/);
      assert.ok(!res.result.content[0].text.includes("must not be disclosed"));
    }
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("read_cos rejects a file symlink even when its target is an allowed file", async (t) => {
  const fixture = createFixture();
  writeFileSync(path.join(fixture.dataDir, "persona.md"), "Historical persona");
  mkdirSync(path.join(fixture.dataDir, "scene_blocks"));
  try {
    symlinkSync(path.join(fixture.dataDir, "persona.md"), path.join(fixture.dataDir, "scene_blocks", "alias.md"), "file");
  } catch (error) {
    rmSync(fixture.dataDir, { recursive: true, force: true });
    if (error.code !== "EPERM") throw error;
    t.skip("file symlinks require Windows developer mode or elevated privileges");
    return;
  }
  const client = startServer(fixture.dataDir);
  try {
    const res = await toolCall(client, 1, "tdai_read_cos", { path: "scene_blocks/alias.md" });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /symbolic links/);
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("unknown method returns error, does not crash", async () => {
  const fixture = createFixture();
  const client = startServer(fixture.dataDir);
  try {
    const res = await client.request({ jsonrpc: "2.0", id: 99, method: "nonexistent/method" });
    assert.equal(res.error.code, -32601);
  } finally {
    await client.close();
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});

test("malformed JSON does not crash the server", async () => {
  const fixture = createFixture();
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", SERVER_PATH], {
    env: { ...process.env, TDAI_DATA_DIR: fixture.dataDir },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

  try {
    // Send malformed JSON — server should reply with parse error, not crash
    child.stdin.write("not valid json\n");

    // Collect both responses: first is parse error, second is ping
    const responses = [];
    const onLine = new Promise((resolve) => {
      lines.on("line", (line) => {
        responses.push(JSON.parse(line));
        if (responses.length >= 2) resolve();
      });
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })}\n`);
    await onLine;

    assert.equal(responses[0].error.code, -32700, "first response should be parse error");
    assert.deepEqual(responses[1].result, {}, "second response should be ping result");
  } finally {
    child.stdin.end();
    await new Promise((resolve) => child.once("exit", resolve));
    assert.equal(stderr.trim(), "", "server should produce no stderr output");
    rmSync(fixture.dataDir, { recursive: true, force: true });
  }
});
