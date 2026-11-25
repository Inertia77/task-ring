# TaskRing Supabase workspace cutover

## Authoritative data
- public.taskring_workspace.configuration: existing task, weekly plan, learning, fitness, reference and other persistent configuration structure (JSONB, no task-code renumbering).
- public.taskring_workspace.execution: versioned completion keys, study sequence metadata, time logs and deletion tombstones. Separate configuration/state revisions.
- public.taskring_workspace_config_history: prior config revisions.
- public.taskring_workspace_migration_backup: immutable source and local snapshot captured at initialization.
- public.game_routine_catalogs / public.game_routine_tasks: authoritative daily/weekly definitions.
- public.game_play_policies: game identity and tiers.
- public.game_ops_tasks: limited and recurring operations and their archive/completion lifecycle.

All owner-scoped via Supabase Auth and RLS. No browser service-role key. JSONB retains unknown legacy fields for compatibility; routine definitions and operations are not duplicated in workspace configuration. Existing local keys and device UI preferences remain compatible. Active timer remains device-local as before.

## Cutover
The new runtime uses the already existing Supabase Auth session. For a legacy device with an existing Gist token, it attempts a single verified read-only migration. No Gist writes exist. A manual one-time migration button is available if needed. If config or state is missing, undecryptable, conflicting, or the account lacks the existing routine catalog, it stops rather than initializing from demo data. An explicitly confirmed complete backup is also accepted.

Initialization atomically stores canonical config, merged execution and source backup. Readback must match before the local legacy token is retired. Other devices must adopt the same workspace; account mismatch blocks sync. Once initialized, Gist is not read again. Do not delete the historical remote Gist until the actual user's production workspace is verified, including configuration and execution counts, and all devices have adopted the new backend.

## Unified editing and JSON
Workbench and reviewed JSON import submit configuration and game changes through save_taskring_workspace_config_v2. The database transaction updates config, routines, policy and active operations; any stale revision or stale row baseline rolls back. Full backup import uses import_taskring_workspace, including the merged execution state in the same transaction. Archived operation history is not overwritten; removed active operations are archived, and games are retired by tier F rather than physical deletion. Legacy JSON without explicit policy/operation sections leaves those data sources unchanged.

Offline local edits are preserved; cloud writes require authentication and conflict checks. Stale config is not silently overwritten. State sync merges timestamped records and tombstones, retries CAS conflicts, preserves existing completion IDs, and retains full server time log history beyond the old local UI limit.

## Rollout verification
Backend schema and transaction tests were executed with rollback-only transactions. Actual personal migration requires the user's authenticated browser or verified full backup; no production workspace row is seeded with test or default data. Confirm the workspace row, source backup and stable completion keys after the first successful production initialization before removing the last legacy reader.
