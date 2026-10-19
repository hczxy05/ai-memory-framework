# Project-isolated deployment

Use one Docker Compose project per user/project trust boundary. Sessions and Agents within that project intentionally share long-term memory. Never use a session id or a different workspace alone as an ownership boundary.

## Create a private project bundle

Prepare a complete, validated OpenClaw JSON configuration for your model and local SQLite plugin. The example fragments are not complete production configurations. Keep credentials out of Git. For a bounded lab, use a private model proxy and dummy client credential; never give the model container the real provider key.

Node 22/24 and Docker Compose are required. Run the generator from this repository:

```bash
node integrations/openclaw-tdai-local/project-config.mjs /private/base.json alpha /private/alpha
docker compose -f /private/alpha/compose.json up -d --build
node integrations/openclaw-tdai-local/project-config.mjs /private/base.json beta /private/beta
docker compose -f /private/beta/compose.json up -d --no-build
```

Choose a unique id for every trust boundary. The generator refuses an existing output directory; the bootstrap service refuses to replace different existing configuration. Back up and explicitly review configuration changes before replacing a configuration volume. Do not remove state/workspace volumes to change settings.

Each bundle creates independent Compose-scoped state, workspace and configuration volumes, an independent internal network, a fresh Gateway token and a read-only non-root Gateway with a 2 GiB memory limit. No host directory, Docker socket or host port is mounted/exposed. The one-shot bootstrap has no network and writes only its own configuration volume. Agent workspaces point inside the project's own workspace volume. Auto recall stays disabled.

The image pins Node, OpenClaw 2026.10.4 and TDAI 1.0.3. Dependency lifecycle scripts are disabled, then only OpenClaw's own reviewed package lifecycle is completed during the image build. TDAI's host-patching postinstall is never run. Top-level versions are pinned; npm transitive dependencies are not locked, so retain the built image digest when reproducing a campaign. The third-party provenance diagnostic remains visible.

Private tmpfs mounts provide temporary files and the host runtime's required per-user cache. The immutable config volume makes the host's automatic last-known-good config backup unavailable (EROFS warning); retain and back up the reviewed private bundle as operator. This does not prevent conversation or SQLite state persistence.

## Model connectivity and access

The default internal network has no internet access. Attach a separately managed, bounded model proxy to that project's network, and point both the Agent model provider and TDAI standalone LLM override to it. Alternatively attach the Gateway to the reviewed proxy network explicitly. Connecting to another network is an operator action; do not attach unrelated data services. No host port needs to be published for local CLI access:

```bash
docker compose -f /private/alpha/compose.json exec gateway openclaw config validate
docker compose -f /private/alpha/compose.json exec gateway openclaw agent --agent tdai-poc --message "Your question"
```

The initial offline database migration must finish before another CLI command validates/uses the store. A config-read maintenance error during startup requires waiting for readiness, not resetting the database.

## Isolation acceptance

Seed distinct synthetic facts into both projects through actual Agent turns. Verify positive local and negative peer results through native L0/L1 tools in both directions, then repeat after restart. Check L2/L3 object storage too. Inspect mounts: state/workspace/config volume names must differ and every mount must be a Docker volume. Tokens and configurations stay private.

TDAI 1.0.3 native read_cos uses memory-tdai/cos-storage; generated pipeline/MCP profile files use memory-tdai itself. The object isolation fixture seeds both roots and is not evidence that native read_cos reads pipeline-generated profiles. Use the framework MCP adapter for those generated files. No symlink bridge or vendor source modification is applied.

See [follow-up validation](../../test-results/2026-10-16-followup/README.md) for the tested image, bidirectional evidence and actual endurance status.
