---
name: Managed API workflow restarts
description: Development workflow behavior when an API restart collides with a previous process on the assigned port.
---

When a managed API workflow reports a port collision but the health endpoint still responds, treat the responding process as a possible orphan from an earlier workflow attempt rather than assuming the current workflow is healthy.

**Why:** A restart can leave the previous API process listening while the new managed workflow exits, producing misleading mixed signals: successful requests but a failed workflow state.

**How to apply:** Check the workflow logs and process list together; clear only the stale API process, restart the managed workflow, then confirm both a running workflow and a successful health response.