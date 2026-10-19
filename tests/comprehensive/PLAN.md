# Comprehensive validation plan

## Purpose

Reproduce and publish the project's security, retrieval, governance and actual OpenClaw behavior using synthetic data only. This plan is fixed before the paid evaluation. Failed cases remain in the report.

## Scope and acceptance

- Re-run the existing cross-platform security suite. Security invariants require zero cross-scope reads, unauthorized authority writes, forged/replayed approvals, secret acceptance and database corruption.
- Exercise 10,000 SQLite records, FTS5 and LIKE fallback, concurrent writers/deduplication, lock failures, store restarts, malformed input and bounded reads. Publish measured throughput and latency; no unmeasured production SLA.
- Evaluate 240 labeled governance cases across 16 template families, three repetitions, with policy guidance versus a minimal baseline. Six decisions per model request; 1,440 total paired decisions, 240 model requests. Report each family, every raw answer and incorrect/unparseable decision. Model failure never becomes authorization.
- Run actual OpenClaw Gateway turns covering multilingual capture, corrections, long sessions, concurrent independent sessions and Gateway restart. Query real L0/L1 through the framework MCP, and test native-plugin behavior separately. A loaded plugin is insufficient.
- Test Promotion Gate under independent container UIDs and concurrent executors, including stale, expired, tampered and replayed candidates. Synthetic automated approvals are explicitly simulations.
- Use 30 minutes of bounded offline soak and a shorter real Gateway soak. This is not a multi-day production endurance result.
- Frozen corpus, source hashes, environment, complete per-case results, cost accounting and limitations are published to the existing GitHub PR. No secrets, personal conversations, live databases or complete runtime configs.

## Budget and stop rules

The user authorized a total maximum of 100 RMB on 2026-10-16. Preserve the existing private ledger, including every prior reservation and incomplete request. The proxy enforces a cumulative maximum 90 RMB conservative reservation, 350 calls and the existing 24-hour expiry. Remaining headroom covers pricing/measurement uncertainty. Never reset the ledger to continue a run. Actual model usage may be much cheaper; the aim is coverage, not spending the allowance.

A reservation is persisted before upstream I/O and assumes request UTF-8 bytes plus 16,384 protocol tokens and 2,048 output tokens at 10 RMB/M, exceeding the verified Flash peak 2/8 RMB/M input/output prices. Only the fixed DeepSeek endpoint and Flash non-thinking mode are permitted. There are no other paid egress routes. If limits, authentication or persistence fail, stop paid tests and publish the incomplete coverage.

The previous proxy was stopped with Docker's short default timeout, leaving one reserved request without a completed usage record and a stale owner lock. Preserve that charge reservation; inspect the stopped container before manual lock recovery. New shutdowns drain Gateway first and allow the proxy 60 seconds, exceeding its 45-second upstream deadline.

## Exploratory L2/L3 extension

After the frozen primary evaluation completed, an additional actual scene/persona pipeline test was added without changing the 240 cases, labels or model scores. Its first run reused existing state and ended when old scenes/persona completed; the missing Rust/language anchors correctly failed. The failed report and original harness are retained. The final run uses a fresh state directory and waits for the current anchor facts. Generated content describes a fictional role only. The hardened text/function-only budget proxy is used, with the original cumulative ledger and limits preserved.
