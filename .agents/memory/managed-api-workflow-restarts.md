---
name: Managed API workflow restarts
description: Development workflow behavior when API restart state disagrees with the actual listening process.
---

When a managed API workflow reports a port collision or readiness timeout but the health endpoint still responds, treat the responding process as a possible orphan or workflow-monitor mismatch rather than assuming the current workflow is healthy.

**Why:** A restart can leave the previous API process listening while the new managed workflow exits, or the console readiness check can fail after a clean bind, producing misleading mixed signals: successful requests but a failed workflow state.

**How to apply:** Check workflow logs, process state, and direct HTTP health together. Clear only a stale API process; if the exact command binds the expected address and serves health but readiness still fails, stop retrying and document the platform-monitor limitation.