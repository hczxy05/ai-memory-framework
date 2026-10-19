#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createDatabase, startServer, toolCall } from "./test-support.mjs";

const fixture = JSON.parse(fs.readFileSync(new URL("./benchmark-fixture.json", import.meta.url), "utf8"));
const reports = [];
for (const fallback of [false, true]) {
  for (const scoped of [false, true]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-benchmark-"));
    const db = createDatabase(path.join(dir, "vectors.db"));
    for (const record of fixture.records) {
      const scope = scoped ? record.scope : "all";
      db.prepare("INSERT INTO l1_records(record_id, content, scene_name, priority, session_key, updated_time) VALUES(?,?,?,?,?,?)")
        .run(record.id, record.content, record.scene, record.priority, scope, "2026-01-01");
      db.prepare("INSERT INTO l1_fts(content, record_id) VALUES(?,?)").run(record.content, record.id);
    }
    if (fallback) db.exec("DROP TABLE l1_fts");
    db.close();
    const clients = new Map();
    const details = [];
    try {
      for (let index = 0; index < fixture.queries.length; index++) {
        const q = fixture.queries[index], scope = scoped ? q.scope : "all";
        if (!clients.has(scope)) clients.set(scope, startServer(dir, { TDAI_SESSION_KEY: scope, TDAI_ALLOW_STORE: "" }));
        const started = performance.now();
        const response = await toolCall(clients.get(scope), index + 1, "tdai_memory_search", { query: q.query, limit: 3 });
        assert.ok(!response.result.isError, JSON.stringify(response.result));
        const rows = response.result.structuredContent.results;
        assert.ok(rows.length <= 3);
        const relevant = rows.filter((r) => q.relevant.includes(r.id)).length;
        const rank = rows.findIndex((r) => q.relevant.includes(r.id));
        const leaks = rows.filter((r) => fixture.records.find((v) => v.id === r.id).scope !== q.scope).length;
        if (scoped) assert.equal(leaks, 0, "Scoped search leaked another project's memory");
        details.push({ case: q.id, returned: rows.map((r) => r.id), expected: q.relevant, relevant, leaks,
          reciprocalRank: rank < 0 ? 0 : 1 / (rank + 1), elapsedMs: Math.round((performance.now() - started) * 100) / 100 });
      }
      const answerable = details.filter((q) => q.expected.length);
      const totalReturned = details.reduce((n, q) => n + q.returned.length, 0);
      reports.push({
        retrieval: fallback ? "like" : "fts5", mode: scoped ? "scoped" : "unscoped-fixture-baseline",
        cases: details.length, answerable: answerable.length,
        recallAt3: answerable.reduce((n,q) => n + q.relevant / q.expected.length, 0) / answerable.length,
        mrrAt3: answerable.reduce((n,q) => n + q.reciprocalRank, 0) / answerable.length,
        precisionOnReturned: totalReturned ? details.reduce((n,q) => n + q.relevant, 0) / totalReturned : 0,
        scopeLeakRate: totalReturned ? details.reduce((n,q) => n + q.leaks, 0) / totalReturned : 0,
        noMatchCorrect: details.filter((q) => !q.expected.length).every((q) => !q.returned.length),
        details,
      });
    } finally {
      await Promise.all([...clients.values()].map((client) => client.close()));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}
console.log(JSON.stringify({
  schema: 1, fixture: "benchmark-fixture.json", description: fixture.description,
  baseline: "Same MCP engine with fixture scope keys coalesced, simulating unscoped access; not a historical binary comparison.",
  metrics: "Recall/MRR average answerable queries; precision/leakage use all returned rows; request time includes cold process startup.",
  reports,
}, null, 2));
