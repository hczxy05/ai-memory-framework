# AGENTS.md

## Purpose

This repository provides long-term AI collaboration memory and workflow rules. Read this file at the start of every task. For full specifications, see `rules/memory-policy.md`.

## Memory Layers

| Layer | Location | About |
|---|---|---|
| Agent Rules | `rules/` | How agents behave |
| Project Memory | `project/` + per-project docs | The project |
| Personal Memory | `personal/` | The user |
| Experience | Optional TDAI provider | Historical evidence only |

## Authority (who wins)

```text
Level 0  User Instruction        ← highest
Level 1  Agent Rules             ← governance, safety
Level 2  Project Memory          ← project facts
Level 3  Personal Memory         ← user preferences
Level 4  Verified Experience     ← historical evidence
Level 5  Agent Memory            ← AI's own memory
Level 6  Raw History             ← lowest
```

Full rules: `rules/authority.md`

## Loading (what to read)

```text
1. AGENTS.md                          ← always
2. rules/authority.md                 ← know who wins
3. project/projects.md                ← find the project
4. project/[name]/INDEX.md            ← know what files exist
5. Load only what the task needs      ← be selective
```

Full loading rules: `rules/memory-policy.md`

## Task Records and Verification

- Routine document edits that do not affect the wider project need only the edited deliverable and a brief reply; do not create extra task logs or reports by default.
- Code changes and experiments need the minimum sufficient record without losing important evidence. For recordkeeping or verification decisions, load `rules/conventions.md` and the relevant project's verification decisions.
- Task and report templates are optional scaffolding. Use only the fields that add useful information; follow the memory policy's writing and authorization rules.

## Core Behavior

- **User instruction first.** Current instruction overrides everything.
- **Rules are governance.** User preference cannot bypass safety rules (e.g., confirm before destructive actions).
- **Project Memory is truth.** For project facts, trust project docs over preferences or memory.
- **Be honest.** Distinguish confirmed facts, inferences, and unknowns. Don't guess.
- **Ask, don't assume.** When unknown blocks progress, ask the user.
- **Report conflicts.** Never silently resolve — higher authority wins, but log it.

## Writing Rules

- Memory is not a log. Store only confirmed, stable, reusable information.
- Never store passwords, API keys, tokens, or credentials.
- Before writing, propose: exact change, target file, reason.
- Modify Agent Rules or Project Memory only after user approval (unless current instruction requests that exact change).
- After writing, report what changed and why.

## Promotion

Experience → Candidate → Verified → Project Memory (authoritative)

Full rules: `rules/memory-promotion.md`

## Approval Boundaries

Require explicit user approval before:

- Destructive file, system, or data operations
- Physical actuation or actions that could cause damage
- External deployment or publication
- Financial transactions or commitments
- Installing, updating, or removing skills

## Engineering Style

Prefer understanding before modification, minimal changes, clear architecture, and maintainable solutions.
