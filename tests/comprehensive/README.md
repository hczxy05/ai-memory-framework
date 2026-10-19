# Comprehensive validation

## Purpose

Run and publish reproducible synthetic tests of the framework's actual boundaries, retrieval, governance decisions and OpenClaw integration. See [PLAN.md](PLAN.md) for the frozen scope and budget. This directory does not contain credentials or production conversations.

## Offline checks

Node 22/24 with built-in SQLite is sufficient; no dependency install or model API is needed.

```bash
cd integrations/codex-tdai-local
npm test
npm run benchmark
cd ../..
node --disable-warning=ExperimentalWarning tests/comprehensive/offline.mjs offline-results.json
```

The extended runner seeds 10,000 records, exercises 800 retrieval queries and 800 concurrent write attempts, checks isolation, transaction/index consistency, database locking/recovery and competing Promotion Gate executors, then deletes its temporary stores. Ordinary CI does not run the long soak.

In the prepared Docker lab, opt into the 30-minute soak:

```powershell
docker exec -e SOAK_SECONDS=1800 ai-memory-p2-lab node --disable-warning=ExperimentalWarning tests/comprehensive/offline.mjs /lab/reports/comprehensive-offline-final.json
```

The small original benchmark retains a semantic paraphrase failure. The 10,000-record benchmark measures lexical identifier/phrase retrieval, not semantic reasoning.

## Paid model evaluation

```powershell
docker exec ai-memory-p2-lab node tests/comprehensive/make-corpus.mjs
docker exec -e AI_MEMORY_DOCKER_LAB=1 ai-memory-p2-lab node tests/comprehensive/model-eval.mjs /lab/reports/comprehensive-governance
```

The corpus has 16 hand-written families × 15 variants = 240 labeled scenarios, three repeats, two conditions, six decisions per request: 1,440 scored decisions in 240 calls. Correct options are not sent to the model. Every raw response and missing/incorrect answer is retained. The checkpoint avoids reissuing completed requests; keep its manifest and corpus unchanged when resuming. The labels are synthetic and repeated/template-related observations are correlated.

The runner targets the prepared lab's private budget proxy. Provisioning is separate: use the pinned Node image, dedicated Docker volumes, internal networking, no host workspace/socket mounts, and the already reviewed standalone plugin configuration. The proxy's default remains 12 calls / 4 RMB; a separate operator-owned policy file may explicitly raise the cumulative reservation to at most 90 RMB. The comprehensive run used 350 calls / 90 RMB / existing 24-hour expiry and preserved prior charges. No key belongs in the Agent container, command line, repository or report. The reservation is a deliberately loose upper bound, not actual spending.

## Actual Gateway integration

```powershell
docker exec -e AI_MEMORY_DOCKER_LAB=1 ai-memory-p2-lab node --disable-warning=ExperimentalWarning tests/comprehensive/openclaw-eval.mjs /lab/reports/comprehensive-openclaw
```

This opt-in runner expects OpenClaw 2026.10.4 and TDAI 1.0.3 already installed at the lab paths. It creates two fresh state/workspace directories, private local Gateway tokens and separate loopback ports. It tests actual English/Chinese L0/L1 capture, a long corrected conversation, authoritative file reads, independent concurrent sessions, scoped MCP recall, native tools in shared versus independent stores, Gateway restart and a short Gateway soak. It drains both Gateways before the proxy is stopped.

A native shared-store cross-session match is an explicitly expected limitation, not a framework isolation pass. Separate Agent ids/workspaces are insufficient; use separate state/data directories or Gateways for different trust boundaries. Native plugin tools do not inherit the MCP adapter's filters.

## Independent operator permission proof

The following uses only fresh named Docker volumes and standard input; no host directory or Docker socket is mounted. The lab source remains private to UID 1000. Three public source files are exported to bootstrap the separate authority volume; bootstrap needs only CHOWN and creates files before transferring ownership.

```powershell
$volume = 'ai-memory-authority-proof-' + [guid]::NewGuid().ToString('N')
$image = 'node@sha256:14078204b6bb268c107ceff6d3c43f45a888105e5c2b18b14c32b3409d93a1b0'
$bootstrap = (docker exec ai-memory-p2-lab cat /lab/repo/tests/comprehensive/authority-bootstrap.mjs) -join [Environment]::NewLine
$sources = docker exec ai-memory-p2-lab node /lab/repo/tests/comprehensive/authority-export.mjs
docker volume create $volume
$sources | docker run --rm -i --network none --read-only --user 0:0 --cap-drop ALL --cap-add CHOWN --security-opt no-new-privileges --mount "type=volume,source=$volume,target=/authority" $image node --input-type=module -e $bootstrap
if ($LASTEXITCODE -ne 0) { throw 'Authority bootstrap failed' }
foreach ($stage in @(@('1001:1001','operator-init'), @('1000:1000','agent'), @('1001:1001','operator-apply'), @('1000:1000','agent-after'))) {
  docker run --rm --network none --read-only --user $stage[0] --cap-drop ALL --security-opt no-new-privileges --mount "type=volume,source=$volume,target=/authority" $image node /authority/fixture.mjs $stage[1]
  if ($LASTEXITCODE -ne 0) { throw 'Authority proof failed' }
}
```

UID 1000 can propose but cannot read the approval key, write authority, rename the protected operator directory or replace executor code. UID 1001 validates and applies exactly one signed synthetic proposal; forged, tampered and replayed receipts fail. Automated fixture approval simulates the operator and is never real human approval for user memory.

## Interpretation

Publish failures, limitations, per-case data, source/corpus hashes, software versions, elapsed time and token accounting together. Passing keyword fixtures or multiple-choice governance decisions does not prove production semantic accuracy. A bounded soak does not prove multi-day reliability. Budget reservations and actual usage estimates must be reported separately; absent usage must remain unknown.

Budget estimates apply to text-only chat and client-executed function definitions. The proxy rejects remote images/audio/files, unknown message fields and hosted tools before reserving or forwarding; their billing cannot be bounded by request-text bytes.

## Exploratory scene/persona pipeline

After the primary Gateway runner, profile-eval.mjs creates a fresh state directory, enables short L2 scheduling and a synthetic L3 trigger, checks the supplied Rust/language anchor facts, reads generated files through the actual MCP boundary, and verifies PROJECT.md remains byte-identical. It derives its prepared-lab paths from /lab/reports/comprehensive-openclaw/results.json. Run with the same Docker opt-in environment and existing budget proxy. This is separate from the frozen primary evaluation; initial failed results are retained in the dated report.

## Follow-up campaign

See [FOLLOWUP.md](FOLLOWUP.md) for default deployment isolation, the 24-scene free-answer evaluation, real ENOSPC recovery and 72-hour observed-duration Gateway/MCP validation. The dated [follow-up report](../../test-results/2026-10-16-followup/README.md) records completed checks separately from pending endurance.
