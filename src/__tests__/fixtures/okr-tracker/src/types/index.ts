// ── SQL Row Types (relational data) ──────────────────────────────────

export interface ObjectiveRow {
  id: string;
  title: string;
  description: string;
  owner_id: string;
  cycle: string;           // e.g. "Q1-2026"
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  parent_id: string | null; // for hierarchical OKRs
  created_at: string;
  updated_at: string;
}

export interface KeyResultRow {
  id: string;
  objective_id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;            // e.g. "%", "count", "points", "hours"
  measurement_type: 'manual' | 'jira-linked';
  status: 'on-track' | 'at-risk' | 'behind' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface ProgressUpdateRow {
  id: string;
  key_result_id: string;
  value: number;
  note: string;
  updated_by: string;
  updated_at: string;
}

// ── Entity Store Types (JSON config) ─────────────────────────────────

export interface KrJiraConfig {
  jql: string;              // e.g. "project = PROJ AND type = Bug AND status = Done"
  metric: 'count' | 'sum_field' | 'ratio';
  field?: string;           // for sum_field — e.g. "story_points"
  ratio_jql?: string;       // denominator JQL for ratio metrics
}

export interface OkrDisplayConfig {
  default_cycle: string;
  visible_statuses: string[];
  dashboard_layout: 'grid' | 'list';
  color_thresholds: {
    on_track: number;       // >= this % = green
    at_risk: number;        // >= this % = yellow, below = red
  };
}

// ── Queue Event Types ────────────────────────────────────────────────

export interface RecalcEvent {
  key_result_id: string;
  objective_id: string;
}

export interface SnapshotEvent {
  cycle: string;
  triggered_by: 'manual' | 'sprint-complete' | 'scheduled';
}
