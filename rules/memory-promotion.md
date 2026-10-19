# Memory Promotion

## Purpose

Define when experience becomes authoritative knowledge. Experience memory must not directly modify authoritative memory; promotion requires a controlled lifecycle.

---

## Memory States

### Observation（观察）

Raw information from daily work.

Example: "The motor stopped after command."

Status: Cannot be used as knowledge. Just a record.

---

### Experience（经验）

A possible explanation or historical record.

Example: "Maybe caused by PWM stop."

Status: Can be searched. Cannot affect decisions.

---

### Candidate（候选知识）

Potential authoritative information.

Requirements:
- Has evidence
- Has reproduction steps
- Needs verification

---

### Verified（已验证）

Confirmed by:
- Test
- Experiment
- User confirmation

Status: Can be promoted to Authoritative.

---

### Authoritative（权威知识）

Stored in project authoritative files (`STATUS.md`, `BUGS.md`, `DECISIONS.md`, `ARCHITECTURE.md`).

Status: Represents project truth. All agents should trust this.

---

## Promotion Requirements

Information can become Authoritative only when:

| Requirement | Meaning |
|---|---|
| Stable | Not a temporary or transient state |
| Reusable | Useful for future work, not just one-time |
| Verified | Supported by evidence (test, experiment, user confirmation) |
| Relevant | Related to the current project scope |
| Authorized | User or project owner explicitly approves |

All five must be met. Missing any one blocks promotion.

---

## Promotion Flow

```text
Observation
    ↓
Experience (auto-captured)
    ↓
Candidate (has evidence + reproduction steps)
    ↓
Verified (confirmed by test/experiment/user)
    ↓
Authoritative (written to project docs)
```

### Rules

1. Experience memory cannot directly write to authoritative files.
2. Promotion proposals must identify: target file, exact content, evidence, and verification status.
3. Conflicts with existing authoritative memory must be resolved before promotion.
4. User authorization is required for the final promotion step.
5. Repeated recall of the same experience is evidence, not confirmation.

---

## Demotion and Invalidation

Authoritative knowledge can be demoted when:

- New evidence contradicts it
- The project context changes
- It becomes stale or irrelevant

Demotion flow:
```text
Authoritative
    ↓
Superseded (linked to replacement)
    ↓
Deprecated (no longer valid)
```

Mark the original entry with `Superseded` or `Deprecated` and link to the replacement or reason. Preserve history unless removal is explicitly approved.

---

## Example: STM32 PWM Bug

### Step 1 — Observation
```
TIM2 has no PWM output after restart.
```
Status: Observation. Just a symptom.

### Step 2 — Experience
```
Suspect: HAL_TIM_PWM_Stop causes the issue.
```
Status: Experience. Possible explanation, not confirmed.

### Step 3 — Candidate
```
Findings: HAL_TIM_PWM_Stop clears CCER register.
Restarting PWM does not restore CCER state.
```
Status: Candidate. Has evidence and reproduction steps.

### Step 4 — Verified
```
Test: Modified startup to use CCER control instead of stop/start.
Result: PWM works correctly after restart.
```
Status: Verified. Confirmed by test.

### Step 5 — Authoritative
Written to `BUGS.md`:
```markdown
## TIM2 PWM output failure

**Cause:** HAL_TIM_PWM_Stop clears channel enable state (CCER).
**Fix:** Use direct CCER control instead of stopping PWM.
**Status:** Resolved
```
Status: Authoritative. Project truth.

## Optional executable gate

The operator CLI in `integrations/promotion-gate/` enforces signed, scoped, expiring approval bound to exact candidate and target bytes. It appends one reviewed long-term entry to an allowed existing project document. Deploy it with a private operator key and Agent read-only access to authority; otherwise direct writes can bypass any workflow. Verification evidence is reviewed by the operator, not proven true by the CLI. See `integrations/promotion-gate/README.md`.
