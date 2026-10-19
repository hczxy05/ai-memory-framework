# AI Memory Quick Reference

> Version 1.6 · 2026-08-20

## Three Memory Layers

| Layer | Location | Contains | Purpose |
|---|---|---|---|
| Personal Memory | `personal/` | User info, preferences, background | About "you" (the user) |
| Project Memory | `project/` + per-project docs | Status, architecture, decisions, bugs, lessons | About "the project" |
| Agent Rules | `rules/` | Authority, policy, promotion, conventions | How agents behave |
| Experience Memory | Optional TDAI provider | Conversations, attempts, candidates | Historical evidence only |

**Rule:** Agent Rules define behavior. Project Memory is source of truth. Personal Memory provides user context. Experience is evidence only.

## What to Read

| Need | Source |
|---|---|
| User background | `personal/universal-memory.md` |
| Project location | `project/projects.md` |
| Current project state | Project `STATUS.md` or `PROJECT.md` |
| Design | `ARCHITECTURE.md` and `DECISIONS.md` |
| Known issue | `BUGS.md` |
| Verified project lesson | `LESSONS.md` |
| Authority rules | `rules/authority.md` |
| Promotion rules | `rules/memory-promotion.md` |

## Authority Levels

| Level | Source | Rule |
|---|---|---|
| 0 | User Instruction | Highest information priority; operation approval is separate |
| 1 | Agent Rules | Governance, safety |
| 2 | Project Memory | Current verified truth |
| 3 | Personal Memory | User preferences |
| 4 | Verified Experience | Evidence only, verify first |
| 5 | Agent Memory | Hints, not decisions |
| 6 | Raw History | Lowest priority |

## Memory Lifecycle

```text
Observation → Experience → Candidate → Verified → Authoritative
```

Promotion requires: **Stable**, **Reusable**, **Verified**, **Relevant**, **Authorized**

## Workspace Files

| File | Purpose |
|---|---|
| `AGENTS.md` | Supplementary workspace instructions |
| `IDENTITY.md` | Agent display identity |
| `SOUL.md` | Persona, tone, and boundaries |
| `USER.md` | Small workspace profile; stable facts defer to `personal/universal-memory.md` |
| `TOOLS.md` | Local tool notes |
| `MEMORY.md` | Optional non-authoritative bootstrap cache |

For loading rules, query limits, update flow, priority hierarchy, and safety boundaries, see the external `AGENTS.md` and `rules/memory-policy.md`.
