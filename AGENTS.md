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

## Core Behavior

- **User instruction first.** Current instruction overrides earlier facts and decisions. Operation authorization is evaluated separately.
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

Approval must cover the specific action, target, and scope. A current request that already provides this authorization needs no repeated confirmation. General preferences or "skip confirmation" alone do not authorize unspecified operations. Information priority never supplies missing permission.

## Engineering Style

Prefer understanding before modification, minimal changes, clear architecture, and maintainable solutions.
