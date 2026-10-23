# Working Conventions

## Purpose

These are stable collaboration and engineering conventions. Memory authority, admission, and permission rules are defined in `rules/memory-policy.md`.

## Task Workflow

Use a workflow proportional to task complexity and risk:

1. Identify the goal, constraints, and expected deliverable.
2. Load only the minimum relevant Governance and Authoritative Memory.
3. Retrieve a small Experience Memory result set only when history materially helps.
4. Separate confirmed facts, historical evidence, inferences, and unknowns.
5. Ask only about unknowns that block progress, materially change the result, or require a user decision.
6. Make the smallest relevant change within the authorized scope.
7. Verify the result in proportion to risk.
8. Report the outcome, verification, and remaining uncertainty.
9. Propose any reusable memory update and wait for approval before writing.

## Task Records and Validation

### Minimum Sufficient Records

- For routine document wording or formatting changes with no wider project effect, deliver the edited artifact and a brief reply. Do not create additional logs, completion summaries, or check reports by default.
- For code changes and experiments, retain a concise record in the appropriate existing project record or change history. Include the source/version, key change and reason, parameters or environment that affect interpretation, actual verification and results, and material failures, regressions, or unresolved/unverified items. Experiments also need the baseline, key metrics, raw evidence references, and the decision to adopt or reject the result. Include only applicable information.
- Reference existing source, data, and evidence instead of copying them into several reports. Preserve enough information to reproduce or compare a result, explain a decision, and resume work. Shortening a record must not hide important negative results or discard required evidence.
- Task/report templates are optional; omit empty or irrelevant sections. Recordkeeping does not itself authorize promotion into long-term memory; follow the memory policy's purpose and write-authorization rules.

### Useful Verification

- Choose the smallest relevant check that can detect failure modes introduced by the change. An existing IDE build or target-platform test may be appropriate; distinguish compilation, simulation, and actual target execution in the result.
- Follow the project's agreed verification workflow. When routine local compilation or simulation adds no independent evidence beyond the relevant target-platform gate, skip that duplicate work. Special or critical logic changes, observed errors, or unresolved correctness questions call for targeted checks.
- A skipped check is unverified, not passed. Stop after the required checks provide sufficient evidence; expand verification only when new changes, failures, or unresolved concerns justify it. Running a check does not require writing a separate report.

## Communication

- Lead with the outcome, then explain the reasoning and important trade-offs.
- Use plain language and enough technical detail for the audience.
- State unknowns and assumptions explicitly.
- Prefer concrete recommendations, commands, and examples over abstract advice.
- Keep routine reports concise; expand when risk, ambiguity, or learning value warrants it.

## Coding

Prefer:

- Minimal, focused changes.
- Clear interfaces and existing architecture preservation.
- Maintainable solutions over temporary patches.
- Root-cause understanding before modification.

Avoid:

- Unapproved broad rewrites.
- Unrelated changes.
- Removing behavior before understanding its purpose.
- Changing several diagnostic variables at once.

## Debugging

For non-trivial failures:

1. Load current `PROJECT.md` or `STATUS.md` context.
2. Check `BUGS.md` for confirmed known issues.
3. Retrieve historical experience only if it could add useful evidence.
4. Reproduce and describe the observed behavior.
5. Form a hypothesis and verify it.
6. Apply the smallest effective fix.
7. Test the result and record only confirmed reusable conclusions.

For a simple issue with an obvious verified cause, skip unnecessary ceremony and fix it directly.

## High-Risk Work

Approval requirements are defined in `AGENTS.md` and the memory policy. Before an authorized high-risk action, confirm the exact target and configuration, consider failure modes, and keep a rollback path when practical.

## Skill Review

Prefer reusing an existing skill. Before an authorized skill installation or update, inspect its instructions and source for arbitrary execution, sensitive-path access, data exfiltration, and unsupported claims.

## Extending These Conventions

Add only confirmed, stable, cross-project conventions. Keep project-specific lessons in the project that verified them.
