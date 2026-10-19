# Reproducible retrieval baseline

Run `npm run benchmark` in this directory. No API key, model, external database or dependency install is required. The runner starts the actual MCP server against temporary SQLite stores and removes them afterwards. Fixtures and relevance labels are in benchmark-fixture.json.

The comparison uses the same engine twice: the scoped dataset retains project keys; the unscoped fixture baseline coalesces all keys. This simulates access without isolation, not an old release binary or a comparison with another vendor.

Seven synthetic queries cover English, Chinese, scene-only matches, another project, a budget rule, an absent answer and a deliberate semantic paraphrase. Both FTS5 and LIKE fallback are measured.

Observed on 2026-10-16, Node 24.22.0 Linux:

| Mode (both retrieval paths) | Recall@3 | MRR@3 | Precision on returned rows | Scope leakage |
|---|---:|---:|---:|---:|
| Unscoped fixture baseline | 5/6 | 7/12 | 5/9 | 4/9 |
| Scoped | 5/6 | 5/6 | 1 | 0 |

Recall and MRR average only the six answerable queries; precision and leakage divide by all returned rows. The absent-answer query correctly returns nothing. Latency includes cold process startup and is informational.

The semantic-gap query expects the rollback memory but asks for “restore deployment”; the keyword retriever misses it. The benchmark deliberately retains that failure. These seven curated cases do not establish production accuracy or evaluate an LLM's factual reasoning, stale-memory acceptance, or token savings. Promotion expiry, stale snapshots, forged approval and replay are separately tested by ../promotion-gate/gate.test.mjs. Expand the labeled corpus before drawing broader conclusions.
