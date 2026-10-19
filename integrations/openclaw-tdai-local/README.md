# OpenClaw local TDAI integration

This integration uses local SQLite; Tencent Cloud credentials are not required. Runtime data and secrets stay outside the Git repository.

## Tested versions and configuration

Verified on Linux Docker with Node 24.22.0, OpenClaw 2026.10.4 and @tencentdb-agent-memory/memory-tencentdb 1.0.3. Older releases may use different configuration keys. In 2026.10.4, `agents.list` has moved to keyed `agents.entries`; multi-agent rosters also require agents.ownership="explicit". The config fragment uses both current fields. Use `openclaw config validate` after merging, and `openclaw doctor --fix` for an existing old configuration.

Read the framework AGENTS.md first. Merge openclaw.config.fragment.example.json into an existing configuration; do not replace a complete user configuration.

```bash
openclaw plugins install @tencentdb-agent-memory/memory-tencentdb@1.0.3 --pin --force --no-enable --accept-capabilities
openclaw config validate
openclaw plugins inspect memory-tencentdb --runtime --json
```

Review the source and declared capabilities before using --force or --accept-capabilities. These flags acknowledge a reviewed third-party installation; they do not grant official trust. Disable dependency lifecycle scripts for the test install (`NPM_CONFIG_IGNORE_SCRIPTS=true`): this package's postinstall otherwise patches OpenClaw's bundled JavaScript. No such patch was applied during verification.

## Provenance and model execution

OpenClaw 2026.10.4 grants trusted plugin runtime capabilities to catalog-backed official plugins. This third-party npm package reports `provenance-invalid` even with an exact npm install record. An allowlist or reinstall does not make it official. Keep that diagnostic visible; do not edit the catalog, registry or host runtime to pretend it is trusted.

The supported local TDAI pipeline can instead use its documented standalone LLM override (`llm.enabled: true`) with an OpenAI-compatible endpoint. This avoids depending on privileged embedded-agent runner APIs that have changed across OpenClaw versions. Ordinary conversation hooks and memory tools were verified on the real Gateway. The test fragment in openclaw.test.fragment.json uses a budget proxy with a dummy client credential; the real DeepSeek key is held by the proxy in a different Docker volume and UID.

The normal fragment leaves the independent LLM disabled; deployments using the host's runner must verify that runner on their exact OpenClaw version, or explicitly configure the standalone override. A loaded plugin manifest alone is not evidence that extraction works.

## Isolated model test

The test lab uses a dedicated Docker volume for code/home/reports, a separate private secret volume for the proxy, and an internal network. No host workspace, Docker socket or user credentials are mounted into the Agent. The proxy alone has outbound connectivity, a fixed DeepSeek HTTPS endpoint, Flash-only requests, a maximum 2048 output tokens, and a persistent limit of 12 calls / 4 RMB conservative reservation / 24 hours. Its estimate uses request UTF-8 bytes plus a large protocol overhead at 10 RMB per million tokens, above the verified peak Flash input/output prices of 2/8 RMB per million on 2026-10-16. This is a local guard, not an account-wide provider billing cap; provider prices can change. A corrupted ledger or an existing owner lock fails closed.

Use only synthetic data. openclaw.test.fragment.json is a fragment for this lab, not production onboarding. It disables unrelated memory, heartbeat and cron features. It contains no real model credential or Gateway token; create a random local Gateway auth token before starting it. Configure the key in the proxy's private volume, never in a prompt, repository or report.

Start the Gateway inside the container and run:

```bash
docker exec -e AI_MEMORY_DOCKER_LAB=1 ai-memory-p2-lab node /lab/repo/integrations/openclaw-tdai-local/openclaw-smoke.mjs
```

The smoke test uses the persistent Gateway, not `agent --local`: a short-lived local CLI may exit before its asynchronous L1 extraction persists. It waits for actual L0/L1 rows, checks scoped recall through the framework's actual MCP server, rejects another scope's recall, and emits an unsigned synthetic promotion candidate. It never approves its own candidate. The separate Promotion Gate operator fixture verifies the final write under a different UID; its automated approval is test simulation, not evidence of human approval for real memory.

Observed end-to-end: two L0 rows, one L1 row, scoped MCP recall succeeded, unrelated scope returned nothing. A real extracted fixture candidate was then promoted by UID 1001; Agent UID 1000 could neither write the authority volume, read the approval key, nor replace the executor. Tampered and replayed receipts were rejected.

Tests consume model credits and are opt-in. Normal CI runs only offline tests and the synthetic retrieval benchmark. To rerun, start only the test Gateway and budget proxy; preserve the budget ledger so retries do not reset the limits. Stop both after testing. Inspect a stale lock and ledger before manual crash recovery; never automatically reset the budget.

## Data boundary

The tested local store is `~/.openclaw/memory-tdai/vectors.db`. Use separate OpenClaw state/data directories per user/project/agent trust boundary. The native plugin is third-party code and is not the framework MCP adapter: the framework's scoped filters do not retrofit ownership controls into native plugin tools.

Capture/extraction are historical evidence only. They do not authorize promotion, overwrite Markdown, or prove a fact is true. Use the [operator Promotion Gate](../promotion-gate/README.md) with protected files and a separate approval key. Do not commit databases, JSONL, model keys, Gateway tokens, full runtime configurations or reports containing real conversation data.

## Expanded verification

See [comprehensive validation](../../tests/comprehensive/README.md) for the labeled governance evaluation, actual two-Gateway tests and independent operator permission proof. Shared native-plugin stores were observed to return another session's memory even with a different Agent session key. Use a dedicated OpenClaw state/data directory per trust boundary; workspace or Agent routing alone is insufficient. The original example's capture exclusion is a routing choice, not storage isolation.

The proxy defaults to the small smoke-test limits. An operator-owned `/private/budget-policy.json` may raise them explicitly, with an absolute code ceiling of 90 RMB cumulative reservation. Preserve the ledger and stop Gateways before `docker stop --timeout 60 ai-memory-p2-budget` so pending extraction usage can finish recording.

Budget estimates apply to text-only chat and client-executed function definitions. The proxy rejects remote images/audio/files, unknown message fields and hosted tools before reserving or forwarding; their billing cannot be bounded by request-text bytes.

## Default project deployment

For a new trust boundary, use the [project-isolated Docker bundle](PROJECT-ISOLATION.md). It creates independent containers and data volumes rather than adding another Agent to a shared native store. Existing manually configured installs still require explicit state/data separation.
