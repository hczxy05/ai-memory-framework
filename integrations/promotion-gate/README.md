# Promotion Gate

## Purpose

Promote one reviewed, long-term candidate into an existing project document. This is an optional operator CLI, separate from the MCP server. It never exposes approval-key creation or signing to an Agent tool.

The gate validates scope, a target allowlist, verification evidence, literal stable/reusable flags, a maximum 24-hour validity, secret heuristics, the declared Purpose, and the exact existing document hash. Operator approval is an HMAC receipt bound to all reviewed fields and the canonical project root. Apply checks the signature, locks the project, rechecks the snapshot, and atomically appends the reviewed content with provenance. Replaying a receipt fails because the base hash has changed.

## Operator workflow

Create a private operator directory outside the Agent workspace. The key and policy must be inaccessible to the Agent. Give the Agent read-only access to authoritative documents and proposals only; the executor alone gets write access. Otherwise any actor with the operator key or arbitrary write access can bypass the boundary. A flag, an interactive terminal, or a digest alone is not proof of human identity.

Policy JSON:

```json
{"root":"/authority/project","scope":"user:alice:project:orion","files":["LESSONS.md","BUGS.md"]}
```

Only existing root-level PROJECT.md, STATUS.md, ARCHITECTURE.md, DECISIONS.md, BUGS.md or LESSONS.md are eligible, and the policy must explicitly allow each file. Each file must have a Purpose heading. Governance and personal memory are outside this CLI's scope.

Candidate JSON:

```json
{
  "scope":"user:alice:project:orion",
  "target":"LESSONS.md",
  "content":"## A verified lesson\nThe exact reviewed Markdown addition.",
  "base_sha256":"<SHA-256 of the current target bytes>",
  "stable":true,
  "reusable":true,
  "evidence":{"source":"test or source reference","summary":"What was actually verified","verified_at":"<ISO date>"},
  "expires_at":"<ISO date within the next 24 hours>"
}
```

Run these from the trusted operator environment:

```bash
node gate.mjs init-key /operator/promotion.key
node gate.mjs review /operator/policy.json candidate.json
node gate.mjs approve /operator/policy.json candidate.json /operator/promotion.key receipt.json
# At the interactive prompt, review the full plan and type APPROVE <digest>.
node gate.mjs apply /operator/policy.json candidate.json /operator/promotion.key receipt.json
```

Neither init-key nor approve overwrites an existing file. The receipt contains no key. The document's appended provenance records the approved digest, scope and evidence. A failed or stale approval leaves the target unchanged. The shared secret detector is heuristic; the operator still reviews facts and confidentiality.

## Limits and recovery

This first version only appends long-term entries; it does not edit/remove prior decisions, decide whether evidence is true, or implement dynamic status replacement. Existing authorized Markdown workflows still handle those operations. It is not a sandbox and cannot prevent another process with direct write privileges from changing Markdown.

Use separate OS users or containers for Agent and operator. POSIX keys must be operator-owned and mode 0600; on Windows enforce equivalent ACLs, or use the Docker deployment. Parent directories must not be writable by untrusted actors. Portable path checks cannot prevent a privileged concurrent directory replacement.

A concurrent executor is rejected by the exclusive project lock. If a process crashes, inspect the document, receipt and any temporary file before manually recovering the stale lock. Do not delete locks automatically. File data is synced before rename; this is not a cross-file transaction or a guarantee against every storage/power failure.

```bash
node --test gate.test.mjs
```
