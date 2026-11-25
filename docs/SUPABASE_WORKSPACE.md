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

## Cutover (completed)
The production account was migrated and readback-verified on 2026-11-25. The current runtime uses only Supabase Auth and workspace RPCs; legacy Gist network readers, writers and the one-time migration control are retired. Existing devices adopt the same authenticated workspace and merge versioned local completion records, with a confirmation if local configuration differs. A missing workspace can only be initialized from an explicitly confirmed complete JSON backup. An account mismatch blocks writes. The obsolete local token is discarded after verified workspace adoption; completion key namespaces are retained for compatibility.

The immutable migration source backup remains in Supabase. The external historical Gist itself is not deleted by the application; confirm all devices have adopted the new backend before deleting the remote backup and revoking the dedicated old token. Do not revoke unrelated GitHub access.

## Unified editing and JSON
Workbench and reviewed JSON import submit configuration and game changes through save_taskring_workspace_config_compact. The database transaction updates config, routines, policy and active operations; any stale revision or stale row baseline rolls back. Full backup import uses import_taskring_workspace, including the merged execution state in the same transaction. Archived operation history is not overwritten; removed active operations are archived, and games are retired by tier F rather than physical deletion. Legacy JSON without explicit policy/operation sections leaves those data sources unchanged.

Offline local edits are preserved; cloud writes require authentication and conflict checks. Stale config is not silently overwritten. State sync merges timestamped records and tombstones, retries CAS conflicts, preserves existing completion IDs, and retains full server time log history beyond the old local UI limit.

## Rollout verification
Production migration was verified with 4,531 state metadata records, 54 time logs and 22 deletion markers, with zero missing old state keys. See EXECUTION_INCREMENTAL_SYNC.md for the incremental index and logical archive. Full backup export explicitly reads the complete execution history; normal synchronization reads and writes only changed records.
