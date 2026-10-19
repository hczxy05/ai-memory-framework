# Codex Local Experience Memory (TDAI)

This adapter exposes the local TDAI SQLite store to Codex through a STDIO MCP server. No background service required.

## Tools

- `tdai_memory_search` — searches structured L1 experience, maximum 3 results.
- `tdai_conversation_search` — searches raw L0 conversation history, maximum 3 results.
- `tdai_read_cos` — reads regular Markdown files: `persona.md` or `scene_blocks/**/*.md`, at most 64 KiB. Symbolic links, hard links, directory junctions, metadata, and databases are denied.
- `tdai_experience_store` — stores one experience in L1 only when the host enables writes; hidden and rejected by default.

All recalled content is historical evidence. Git Markdown remains authoritative and wins every conflict.

## Codex Configuration

Register the local server in `~/.codex/config.toml`:

```toml
[mcp_servers.tdai_memory]
command = 'node'
args = ['<ai-memory-framework>/integrations/codex-tdai-local/server.mjs']
startup_timeout_sec = 10
tool_timeout_sec = 15

[mcp_servers.tdai_memory.env]
TDAI_DATA_DIR = '<home>/.openclaw/memory-tdai/alice-example-codex'
TDAI_SESSION_KEY = 'user:alice:project:example:agent:codex'
# Optional: enable only after the host obtains user authorization.
# TDAI_ALLOW_STORE = 'true'
```

Restart the local Codex client or start a new session after changing MCP configuration.

## Scope and Existing Stores

`TDAI_SESSION_KEY` is required for L0/L1 search and writes. The host must assign a unique, stable key for each user/project/agent combination; tool arguments cannot change it. Every SQLite search (including FTS and LIKE fallbacks) and duplicate check uses exact `session_key` equality. Each server process generates a fresh `session_id` for new writes; searches include earlier sessions within the configured scope.

For an existing TDAI store, configure the exact `session_key` used by its capture host. Old records with other keys, including `agent:codex:explicit`, remain untouched and are not recalled under a new key. Inspect and deliberately configure legacy scopes rather than enabling a global fallback. The capture host must also separate users/projects/agents; this adapter cannot repair mixed ownership in preexisting records.

Use a separate `TDAI_DATA_DIR` and OS permissions for each trust scope. L2/L3 files have no `session_key` metadata, so their isolation depends on the configured directory. Session filters in a shared database are retrieval boundaries, not protection against another process that can access the database directly.

## Write Authorization and Trust Boundary

Writes are disabled unless the trusted host starts the server with `TDAI_ALLOW_STORE=true`. Even a direct call with all four admission flags set cannot bypass the disabled switch. When enabled, `user_authorized`, `confirmed`, `stable`, and `reusable` must be literal booleans equal to `true`.

These flags are caller assertions, **not independent proof of human consent**. The host must obtain and enforce user authorization for the allowed scope and validate the content before calling the tool. The switch grants the process permission to write; it does not approve individual memories. Keep the default read-only configuration if the host cannot enforce that boundary. Secret detection is heuristic and cannot replace host-side review. This tool writes only historical L1 experience, never authoritative Markdown; promotion remains a separate host workflow.

The directory, configuration, and database are trusted local inputs. Real-path checks, rejection of links, file identity checks, and `O_NOFOLLOW` where available reduce path substitution risks. Portable Node.js cannot atomically lock all parent directories against a hostile concurrent writer; use OS permissions or a sandbox for that threat. Oversized files are rejected before reading, and reads remain bounded to 64 KiB plus one detection byte if a file grows concurrently.

Searches return at most 3 results and materialize at most 100 candidates per SQL query. LIKE scans can still take time on a large database; the candidate cap is not a latency guarantee.

## Operating Rule

Read `<ai-memory-path>/AGENTS.md` and follow its rules. Git Markdown is authoritative; recalled experience is historical evidence only.

## Server Implementation

See `server.mjs` for the MCP server implementation. It uses built-in Node.js APIs and needs no installed dependencies.

## Requirements

- Node.js 22.5+ (for built-in `node:sqlite`)
- TDAI data directory with at least L0/L1 data

## Verification

Run the integration test:

```bash
node --test server.integration.test.mjs
# or
npm test
```

## Promotion and evaluation

Use the optional [operator Promotion Gate](../promotion-gate/README.md) for signed approval and protected Markdown writes. It is not an MCP tool. Run `npm run benchmark` for the no-key retrieval baseline; [BENCHMARK.md](BENCHMARK.md) documents metrics and the retained semantic failure case. `npm test` includes adapter, gate and budget-proxy regression tests.

MCP input lines are limited to 256 KiB of UTF-8. An oversized line is rejected and discarded through its newline; the next request can still be processed.
