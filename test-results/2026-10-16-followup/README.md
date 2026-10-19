# Follow-up: project isolation, free answers and endurance

This is a follow-up to the [original comprehensive campaign](../2026-10-16-comprehensive/README.md). All data are fictional fixtures. Host source/workspaces remain unchanged; code, runtime state and reports stay in Docker volumes.

## Completed checks

- New default deployment: independent Compose project, state/workspace/configuration volumes and network per trust boundary; random per-project Gateway token, no host/socket mounts or published host ports, non-root read-only Gateway, bounded CPU/memory. An offline bootstrap owns only its own config volume. Actual generated bundles were built and run, including the required official OpenClaw build-time lifecycle and private cache tmpfs. TDAI's postinstall patch is never run.
- Both projects captured real L0 and L1 through OpenClaw 2026.10.4 / TDAI 1.0.3 / DeepSeek Flash. Native memory and conversation queries pass local positive and peer negative checks in both directions. Native object-storage persona/scene sentinel reads are isolated too. Mount and resource inspection is archived.
- Final local unit suite: 48 passed, zero failed/skipped. Original benchmark and 10,000-record FTS5/LIKE/concurrent-write/locking/corruption/promotion recovery suite passed again.
- A dedicated 64 MiB tmpfs was filled until actual ENOSPC. SQLite writes failed safely; deleting the owned synthetic filler restored successful writes in the same MCP process.
- Frozen free-answer evaluation: 24 distinct authored scenarios, identical actual scoped MCP retrieval and Markdown evidence for baseline/policy, six requests, 48 answers. Both conditions: exact answer value 23/24; combined exact answer/status/citation score 22/24; invented citations zero. No measured accuracy uplift.

## Interpreting the two scoring deductions

Both conditions correctly report uncertainty for OPAL's unconfirmed old retention suggestion, but cite the old source to explain that uncertainty. The predeclared exact citation-set label expects no citation, so this is a strict scoring deduction, not evidence that the model adopted the old fact.

Both conditions fail the end-to-end semantic case: the fixed lexical query “restore deployment” does not retrieve “rollback succeeded with revision flint-r4”. They abstain rather than invent the revision. No synonym special case or labels were added after evaluation. This framework's lexical adapter does not promise semantic search; an actual host can choose an appropriate paraphrase query, or a separately validated semantic retriever is required.

The 24 questions were authored by the implementer and are now public. This is a new frozen test, not private independent expert validation. A single paired trial does not establish general accuracy gains.

## Initial failures retained

The first explicitly fictional capture wording reached L0 but produced zero L1 in the native extractor. The raw ACK turn is retained; a subsequent explicit confirmed engineering fixture produced L1. This is not counted as a successful first extraction. Omission due to fictional wording is a hypothesis, not a verified model rationale.

The first native object-file probe wrote fixtures at the pipeline root, while native read_cos resolves the distinct cos-storage root. The corrected storage-isolation fixture uses both actual roots. It does not prove native read_cos consumes pipeline-generated profiles. The framework MCP adapter remains the supported reader for those profiles; no symlink bridge or vendor patch was introduced.

## Genuine 72-hour campaign

**Passed on both projects.** The immutable formal harness completed on 2026-10-19 at 19:38 UTC. Both raw progress files record `mode=--run`, `targetSeconds=259200`, `complete=true`, `passed=true`, `failed=false`, and successful real-model checkpoints at observed days one and two. No monitoring model calls or paid retries were made.

| Check | Alpha | Beta |
|---|---:|---:|
| Actual healthy observed seconds | 259,207.310438 | 259,207.228220 |
| Completed cycles | 25,921 | 25,921 |
| Scoped MCP requests | 103,684 | 103,684 |
| Harness logical native-check counter | 129,605 | 129,605 |
| Planned Gateway SIGKILL and MCP recovery events | 11 | 11 |
| Day-one persisted L0 / L1 rows | 6 / 2 | 4 / 2 |
| Day-two persisted L0 / L1 rows | 8 / 3 | 6 / 3 |
| Whole-container memory peak, bytes | 2,147,487,744 | 2,147,487,744 |
| Final memory.max pressure counter | 13,668 | 11,987 |
| oom / oom_kill / oom_group_kill | 0 / 0 / 0 | 0 / 0 / 0 |

The native-check counter increments by five logical checks per cycle; the implementation makes seven native tool invocations per cycle. It is not a count of individual HTTP requests. Eleven recoveries occurred because the loop completes at 72 observed hours before a twelfth recovery. Recovery duration was excluded from observed time; each recovery took approximately 33–45 seconds. There were no recorded unobserved-gap events. The authority fixture SHA-256 stayed `237339d8ff6949bb5a52beb1688caa95f6c95ccf60e2b0d41b7e618fcc447e28` in both projects.

The preflight remains archived: alpha 120.514866 observed seconds, beta 120.493620, each with four forced Gateway kills and MCP restarts. The formal campaign checked health/native own-positive and peer-negative retrieval, synthetic object-file isolation, scoped MCP write/search, authority stability and periodic SQLite/FTS integrity. Each scheduled paid checkpoint made one real Agent turn per project and waited for L0/L1 persistence.

**Memory limitation:** both 1-CPU / 2-GiB / 128-PID containers reached their memory limit during restart-related pressure. No kernel OOM or OOM kill occurred. This is evidence of bounded survival in this campaign, not evidence that 2 GiB provides comfortable capacity under concurrent production load. Whole-container samples and the initial read-only pressure diagnosis are retained.

**Source provenance:** the frozen source is commit `4ba2c14f98f51fe11172641f6c35532c7561c4e7`. The Git blob and current lab repository use LF and hash to `6d6cba01a48a71f775ecaa8c58d32eafdbff06654280f0cee31f98d1e0099431`. Both active copies contain 128 CRLF line endings introduced by transport and hash to `97ae01322f00c4585c850b53d7370be6e92744da89593ab8bb861e44c83f5fee`, exactly matching their original progress.sourceSha256 throughout execution. Their LF-normalized bytes equal the frozen Git blob. Raw hashes are different; no running source was replaced and no checkpoint was reset. Both byte forms are archived: each endurance-active.mjs.gz preserves the original CRLF bytes; endurance-frozen-lf.mjs preserves the frozen Git blob.

Full [progress, events, turns and compressed Gateway logs](endurance/raw-inventory.json), [terminal summary](endurance/terminal-summary.json), [container resources](endurance/runtime-final.json), [monitor history](endurance/monitor-history.jsonl) and [operator/provenance summary](endurance/operator-summary.json) are archived. Gunzip each log to recover every original log byte. Original copies remain at `/home/node/.openclaw/validation/endurance/` in `ai-memory-followup-alpha_state` and `ai-memory-followup-beta_state`:

| Original log | Uncompressed bytes | SHA-256 |
|---|---:|---|
| Alpha gateway.log | 22,171,748 | fa8bf3cdcb1542e55ca8c1350eba238dd55b734a96fac8834ff71b8adddbb18e |
| Beta gateway.log | 22,175,817 | 54e32b57d5a932cc5c2cbad62d41a0214b268d16f59e45bfa391cb970590e18c |

The raw synthetic runtime SQLite files and private deployment configuration remain in Docker volumes and are not published. Their retained paths and database hashes are listed in the inventory; this report does not claim to upload every runtime file. The harness stops its child Gateway after successful completion, leaving a supervisor for collection; the resulting terminal Docker health status is expected and is not a failed observation cycle.

This tests a single Linux Docker host and synthetic idle/retrieval recovery. It does not establish real-user accuracy, multi-host/ARM support, native Windows Gateway ACL behavior, actual Tencent cloud integration, or recovery from every possible model extraction interruption. The frozen 24-scenario raw answers and both no-accuracy-uplift conclusions remain unchanged.

## Budget and evidence

The previous cumulative ledger is preserved: starting calls 302, reservation 81.94567 RMB, one old interrupted request without usage. This follow-up allows at most 48 additional calls (350 cumulative), including headroom for native background L2 scheduling, retains the 90 RMB conservative reservation ceiling below the user's 100 RMB authorization, and renews only expiry for this campaign. Proxy and model containers have no real key in their configuration; the private proxy UID/volume retains it.

Final cumulative ledger: 324 accepted requests and 323 usage records, retaining the one old interrupted request without usage. The conservative reservation is 87.87896 RMB, below the unchanged 90 RMB proxy ceiling; it is not actual spending. Recorded usage totals 660,453 input and 37,196 output tokens. At the previously recorded peak uncached rates (2 / 8 RMB per million input / output tokens), known usage is estimated at 1.618474 RMB; adding the old unknown-usage reserve of 0.34011 RMB gives 1.958584 RMB. This is a conservative token estimate, not a provider invoice or account-wide bill. The 350-call limit, 96-hour expiry and prior ledger were not extended or reset. See [final no-key ledger](budget-final-ledger.json) and [calculation](budget-final-summary.json); the earlier snapshots are preserved.

See [reproduction and interpretation](../../tests/comprehensive/FOLLOWUP.md) and [deployment guide](../../integrations/openclaw-tdai-local/PROJECT-ISOLATION.md). Initial and final artifacts are accompanied by a SHA-256 manifest checked against the staged Git blob bytes. The complete candidate repository and decompressed logs passed scans against both actual Gateway tokens and, after explicit user authorization, the actual API key inside the UID1002 private process. No secret was returned or copied out of its private volume; see [scan receipt](endurance/publication-security-scan.json).
