# ADR-000 — Template
# DEVPROTOCOL

**Status:** reference
**Date:** YYYY-MM-DD
**Deciders:** [names or roles]
**Supersedes:** —
**Superseded by:** —

---

## Context

Situation/problem → decision needed. Forces at play. Constraints. Be specific — vague context = untraceable decision.

---

## Options considered

| Option   | Pros | Cons |
|----------|------|------|
| Option A | ...  | ...  |
| Option B | ...  | ...  |
| Option C | ...  | ...  |

---

## Decision

Chosen option + why. Ref specific row from table above. State reasoning explicitly — don't restate winner.

---

## Consequences

### Positive
- What gets easier/better

### Negative
- What gets harder/lost

### Risks
- What can go wrong → conditions for revisit

---

## Compliance

How to verify decision followed. What signals violation.

---

## Security Review

**Reviewer:** [name]
**Date:** YYYY-MM-DD
**Summary:** threat model touched, attack surface delta, mitigations. State `N/A — no security impact` only when justified.

Required when `compliance.profile != none`. ADRs dated before the compliance migration date are grandfathered — `adr_validator.py` skips enforcement for them.

---

## Privacy Review

**PII impact:** [none | direct | indirect]
**Classification touched:** [public | internal | confidential | restricted]
**Summary:** which personal data fields are read/written/transmitted, lawful basis if applicable, retention impact. State `N/A — no PII processed` only when justified.

Required when `compliance.profile != none`.

---

## Cost Estimate

**Currency:** [USD | EUR | …]
**One-time:** [amount or `TBD — story #X tracks`]
**Recurring:** [amount + cadence, e.g. `120/month`]
**Summary:** infra, licensing, headcount, vendor SaaS. `TBD` permitted only as `## Cost Estimate (TBD — story #X tracks)` heading variant.

Required when `compliance.profile != none`.

---

## Compliance Impact

Per-profile bullet — list only profiles relevant to this decision:

- **soc2:** controls touched (e.g. CC6.1 logical access), evidence artefact produced.
- **iso27001:** Annex A controls touched (e.g. A.8.24 cryptography), Statement of Applicability delta.
- **hipaa:** PHI handling change, Safeguards touched (Administrative / Physical / Technical), BAA implication.
- **gdpr:** lawful basis, DPIA trigger (Art. 35), data subject right impact, cross-border transfer mechanism.

Required when `compliance.profile != none`.