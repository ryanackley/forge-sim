import { migrationRunner } from '@forge/sql';

// ── DDL Operations ───────────────────────────────────────────────────

export const CREATE_OBJECTIVES_TABLE = `CREATE TABLE IF NOT EXISTS objectives (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id VARCHAR(128) NOT NULL,
  cycle VARCHAR(20) NOT NULL,
  status ENUM('draft','active','completed','cancelled') DEFAULT 'active',
  parent_id VARCHAR(36) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cycle (cycle),
  INDEX idx_owner (owner_id),
  INDEX idx_status (status),
  INDEX idx_parent (parent_id)
)`;

export const CREATE_KEY_RESULTS_TABLE = `CREATE TABLE IF NOT EXISTS key_results (
  id VARCHAR(36) PRIMARY KEY,
  objective_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  target_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  current_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'count',
  measurement_type ENUM('manual','jira-linked') DEFAULT 'manual',
  status ENUM('on-track','at-risk','behind','completed') DEFAULT 'on-track',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_objective (objective_id),
  INDEX idx_status (status),
  FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
)`;

export const CREATE_PROGRESS_UPDATES_TABLE = `CREATE TABLE IF NOT EXISTS progress_updates (
  id VARCHAR(36) PRIMARY KEY,
  key_result_id VARCHAR(36) NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  note TEXT,
  updated_by VARCHAR(128) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_kr (key_result_id),
  INDEX idx_time (updated_at),
  FOREIGN KEY (key_result_id) REFERENCES key_results(id) ON DELETE CASCADE
)`;

// ── Migration Runner ─────────────────────────────────────────────────

const createDBObjects = migrationRunner
  .enqueue('v001_create_objectives_table', CREATE_OBJECTIVES_TABLE)
  .enqueue('v002_create_key_results_table', CREATE_KEY_RESULTS_TABLE)
  .enqueue('v003_create_progress_updates_table', CREATE_PROGRESS_UPDATES_TABLE);

export const runMigration = async () => {
  // Scheduled trigger handlers must return { statusCode } — real Forge records
  // a 424 Failed Dependency for anything else (the okr-tracker silent-424,
  // 2026-07-14). The sim now enforces that on deploy-time firing too.
  try {
    const results = await createDBObjects.run();
    console.log('[migration] Migrations applied:', results);
    return { statusCode: 204, statusText: 'Migrations applied' };
  } catch (err: any) {
    console.error('[migration] Migration failed:', err.message);
    if (err.cause) console.error('[migration] Cause:', err.cause?.message ?? err.cause);
    return { statusCode: 500, body: { error: err.message } };
  }
};
