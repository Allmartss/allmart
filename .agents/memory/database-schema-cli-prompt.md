---
name: Database schema CLI prompt
description: How to handle the workspace database schema command when its interactive safety prompt cannot accept normal shell input.
---

When the schema push pauses on a confirmation prompt, do not truncate tables to bypass it. Verify the database connection used by the application, then apply only additive DDL for the requested tables, columns, indexes, or constraints.

**Why:** The workspace schema command can use an interactive terminal and may not respond to piped input. The configured application database can also differ from the database exposed through an agent callback, so blindly retrying or forcing a destructive option is unsafe.

**How to apply:** Inspect the actual configured connection with the project’s database loader, use a transaction for additive DDL, and verify the resulting tables/columns before restarting the service.