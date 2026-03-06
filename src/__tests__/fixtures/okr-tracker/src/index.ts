import Resolver from '@forge/resolver';
import {
  listObjectives, getObjective, createObjective,
  updateObjectiveStatus, getCycleSummary,
} from './resolvers/objectives.js';
import {
  createKeyResult, recordProgress,
  getProgressHistory, updateKrConfig,
} from './resolvers/key-results.js';
import { recalcKeyResult, snapshotProgress } from './resolvers/consumers.js';
import { onSprintComplete } from './resolvers/triggers.js';
import { runMigration } from './migrations/schema.js';

// ── UI Resolver ──────────────────────────────────────────────────────

const resolver = new Resolver();

// Objectives
resolver.define('listObjectives', listObjectives);
resolver.define('getObjective', getObjective);
resolver.define('createObjective', createObjective);
resolver.define('updateObjectiveStatus', updateObjectiveStatus);
resolver.define('getCycleSummary', getCycleSummary);

// Key Results
resolver.define('createKeyResult', createKeyResult);
resolver.define('recordProgress', recordProgress);
resolver.define('getProgressHistory', getProgressHistory);
resolver.define('updateKrConfig', updateKrConfig);

export const handler = resolver.getDefinitions();

// ── Scheduled Trigger: migrations ────────────────────────────────────

export { runMigration };

// ── Consumer exports ─────────────────────────────────────────────────

export { recalcKeyResult };
export { snapshotProgress };

// ── Trigger exports ──────────────────────────────────────────────────

export { onSprintComplete };
