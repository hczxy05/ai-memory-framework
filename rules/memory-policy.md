# Memory Policy

## Authority and Purpose

This document is the authoritative specification for memory management in AI-Memory. If another file conflicts with it on memory management, this policy wins.

The system should preserve useful confirmed context, load only what a task needs, and prevent guesses, stale history, or secrets from becoming current truth.

## Memory Architecture

| Layer | Location | Role | Authority |
|---|---|---|---|
| Personal Memory | `personal/` | User info, preferences, background | About the user |
| Project Memory | `project/` + per-project docs | Status, architecture, decisions, bugs, lessons | Source of truth for current facts |
| Agent Rules | `rules/` | Authority, policy, promotion, conventions | How agents behave |
| Experience Memory | Optional TDAI provider | Conversations, attempts, candidates | Historical evidence only |

Git Markdown remains the source of truth for governance and current authoritative facts. A file is authoritative only for its defined responsibility; its existence does not make unverified or out-of-scope content authoritative.

Experience Memory must not define current state, override higher layers, or directly modify Governance or Authoritative Memory. The core policy uses the abstract term Experience Memory Provider so providers can be replaced; provider-specific installation, storage, schemas, and tools stay outside it.

## Authority Levels

See `rules/authority.md` for the full authority specification. Summary:

| Level | Source | Priority |
|---|---|---|
| 0 | User Instruction | Highest information priority; operation approval is separate |
| 1 | Agent Rules (`rules/`) | Governance — safety, confirmation, workflow |
| 2 | Project Memory (`STATUS.md`, `ARCHITECTURE.md`, etc.) | Current verified project truth |
| 3 | Personal Memory (`personal/universal-memory.md`) | User preferences and background |
| 4 | Verified Experience (TDAI, experiment logs) | Historical evidence, must verify first |
| 5 | Agent Memory (ChatGPT/Codex/Claude memory) | Hints only, cannot override project docs |
| 6 | Raw History (old conversations, logs) | Lowest priority |

### Conflict Rules

1. User Instruction has highest information priority; operation authorization is evaluated separately.
2. Rules govern agent behavior — preferences cannot bypass safety.
3. Project Memory is source of truth for project facts.
4. Personal Memory provides context, not authority.
5. Experience provides evidence, not truth.
6. Conflicts must be reported, not silently resolved.
7. Never overwrite Level 0-3 memory without explicit user confirmation.

## Controlled Store Collaboration

1. Establish current truth from Agent Rules and the minimum relevant Project Memory.
2. Retrieve Experience Memory only when historical context materially helps. One retrieval round may use one search tool and return at most 3 items.
3. Check recalled evidence for scope, date, supersession, and conflict.
4. Present every returned item with its relevant content and available source, date, scope, and conflict or uncertainty notes.
5. Stop and ask whether the user wants another retrieval round. Do not search again without explicit approval; if nothing matched, report that before asking.
6. Promote a reusable candidate only after validation and user authorization.

Automatic capture and automatic recall are separate permissions. Enabling capture does not authorize querying or injecting history into every task. A workspace `MEMORY.md` may cache small bootstrap context, but it must declare its boundary and defer to the responsible authoritative file.

## Scope and Source Responsibilities

| Source | Layer | Responsibility | Must not be used for |
|---|---|---|---|
| `personal/universal-memory.md` | Personal | Confirmed stable user information and preferences | Temporary tasks or project details |
| `rules/conventions.md` | Agent Rules | Stable cross-project collaboration and engineering conventions | Project-only lessons or unverified pitfalls |
| `project/projects.md` | Project | Project locations, navigation, and dated summary snapshots | Detailed implementation or current technical truth |
| Project `STATUS.md` | Project | Confirmed current state, configuration, and next goal | Undated assumptions |
| `ARCHITECTURE.md` | Project | Current system design | Raw design speculation |
| `DECISIONS.md` | Project | Confirmed decisions and rationale | Unresolved options |
| `BUGS.md` | Project | Confirmed known issues and status | Unverified symptoms |
| `LESSONS.md` | Project | Verified reusable project knowledge | Unverified attempts |
| `PROJECT.md` | Project | Combined authoritative source for a small project | Unrelated projects |

Support files are non-authoritative: `README.md` is human-facing orientation, `rules/changelog.md` is a change summary, and `templates/` contains scaffolding. Templates must follow this policy.

## File Purpose and Write Routing

- Every Governance or Authoritative Memory file must have an explicit, bounded responsibility.
- When creating a file, record the user-declared purpose in a `Purpose` section and in the applicable index when one exists. If the purpose is missing, ask; never infer it from the filename or broaden it silently.
- Before adding, moving, or updating information, read the target file's purpose and confirm that the content belongs there.
- If the requested target conflicts with its declared purpose, or the correct destination is uncertain, do not write. Report the mismatch and ask the user to choose a valid target or explicitly approve a purpose change.

## Loading Rules

Always load `AGENTS.md`. Do not load every project, historical record, unrelated document, or Experience Memory by default.

Load conditionally:

| Need | Load |
|---|---|
| Review or modify memory | This policy |
| User background | `personal/universal-memory.md` |
| Collaboration conventions | `rules/conventions.md` |
| Locate a project | `project/projects.md` |
| Understand a project | Project `INDEX.md` (lists all project files) |
| Current project state | Project `PROJECT.md` or `STATUS.md` |
| Design work | `ARCHITECTURE.md` and relevant `DECISIONS.md` |
| Debugging | `PROJECT.md` or `STATUS.md`, then `BUGS.md`; add `LESSONS.md` only when useful |

Build context in this order:

1. Load `AGENTS.md` and identify the task and project.
2. Load the minimum relevant Authoritative Memory.
3. Decide whether historical experience is needed.
4. If useful and available, run one bounded retrieval round.
5. Validate and present its results, then wait for user approval before another round.
6. Label confirmed facts, historical evidence, inferences, and unknowns before acting.

## Information and Writing Rules

Classify information before using or storing it:

- **Confirmed** — supported by an authoritative file, verification result, or explicit user statement.
- **Inferred** — reasoned from evidence and clearly labeled as inference.
- **Unknown** — not supported well enough; state what is missing instead of guessing.

Never write inferred or unknown information as confirmed memory. Long-term memory must be user-authorized, confirmed, stable, reusable, and secret-free.

Suitable long-term entries include explicit user preferences, final decisions, and verified general lessons. Do not store guesses, credentials, temporary debugging attempts, or failed experiments without reusable value.

A one-time request or repeated observation is not automatically a lasting preference. Record a preference only when the user states that it applies in the future or confirms an agent's proposal; add a confirmation date when useful.

Project lessons stay in their source project by default. Promote one to `rules/conventions.md` only when it is confirmed, cross-project, stable, reusable, and user-approved. Verify an adapted lesson in each target project, and prefer referencing a promoted convention over copying it.

Cross-project technical pitfalls must be confirmed and environment- or tool-wide. Review them after relevant convention or major tool changes, when conflicts or duplicates appear, or on user request. Reclassification or removal requires approval.

## Experience Memory Promotion

See `rules/memory-promotion.md` for the full promotion specification including memory states, promotion flow, and demotion rules.

### Memory States

| State | Description | Authority |
|---|---|---|
| Observation | Raw information, not knowledge | None |
| Experience | Possible explanation, searchable | Cannot affect decisions |
| Candidate | Has evidence + reproduction steps, needs verification | Pending |
| Verified | Confirmed by test/experiment/user | Ready to promote |
| Authoritative | Written to project docs | Project truth |

### Promotion Requirements

Information can become Authoritative only when all five are met:

1. **Stable** — not a temporary or transient state
2. **Reusable** — useful for future work
3. **Verified** — supported by evidence
4. **Relevant** — within project scope
5. **Authorized** — user explicitly approves

Promotion follows:

`Observation -> Experience -> Candidate -> Verified -> Authoritative`

A proposal must identify:

- Target scope and authoritative file.
- Exact proposed fact, preference, decision, issue, or lesson.
- Existing authoritative value and any replacement or invalidation.
- Evidence, source date, project or environment, validation status, and remaining uncertainty.

Repeated recall is evidence, not confirmation. Keep a candidate outside Authoritative Memory until promotion is complete. Experience Memory cannot directly write to Authoritative Memory.

### Demotion

Authoritative knowledge can be demoted when new evidence contradicts it, project context changes, or it becomes stale. Mark as `Superseded` (with replacement link) or `Deprecated` (no longer valid). Preserve history unless removal is explicitly approved.

## Dynamic Project Information

Current status, next goals, and temporary priorities are dynamic. They may be stored in the appropriate project `STATUS.md` or `PROJECT.md` when confirmed, authorized, and dated; they do not need long-term stability or cross-task reusability.

Use only the project's own authoritative document or an explicit user instruction. Do not infer current state from general memory, project-index snapshots, or recalled history.

## Modification Permission

Before modifying Agent Rules or Project Memory, present:

- The exact addition, change, consolidation, or removal.
- The target file and reason.
- Any content replaced, invalidated, archived, or removed.
- Any personal, private, or sensitive information involved.

Then obtain explicit user approval unless the current instruction already requests that exact change. Never modify memory silently.

After writing, report what changed, why it changed, and how consistency was verified.

Explicit approval is also required before destructive file or data operations, physical actuation, external deployment or publication, financial commitments, and skill installation, update, or removal. Approval must cover the specific action, target, and scope. A current instruction that already authorizes that exact operation needs no repeated confirmation. General preferences or "skip confirmation" alone do not grant missing permission. Information priority is separate from operation authorization; see `rules/authority.md`.

## Lifecycle and Maintenance

Review memory when the user requests cleanup, confirmed information conflicts, dated content may be stale, a project changes lifecycle, or a file becomes repetitive or too large.

Allowed lifecycle actions:

- **Correct** inaccurate information with newer confirmed information and record the reason.
- **Supersede** retained historical decisions and link their replacements.
- **Archive** inactive summaries while preserving authoritative project history.
- **Remove** content only when incorrect, useless, duplicated, sensitive, or explicitly requested.

Present exact cleanup, consolidation, archival, or deletion changes and obtain approval first.

For a completed or archived project, update its dated `STATUS.md` or `PROJECT.md`, then update `project/projects.md` only as an index summary. Preserve decisions and confirmed lessons unless removal is explicitly approved.

Keep `rules/changelog.md` concise because Git holds line-level history. When it exceeds 10 version entries or 300 lines, propose an annual consolidation without losing important rationale.

## Conflict Resolution

Use this priority order (see `rules/authority.md` for full specification):

1. Current user instruction (Level 0)
2. Agent Rules (Level 1)
3. Project Memory (Level 2)
4. Personal Memory (Level 3)
5. Verified Experience (Level 4)
6. Agent Memory (Level 5)
7. Raw conversation history (Level 6)

Within Agent Rules, use the most specific applicable rule; this policy controls memory-management matters. Within Project Memory, use the file assigned to the fact, then newer confirmed information.

Project-internal documents beat `project/projects.md`. Experience remains historical evidence even when it is newer; recency alone never promotes it.

## Efficiency Principle

Prefer summaries over logs, indexes over full documents, and relevant context over complete history: maximize useful information while minimizing context.
