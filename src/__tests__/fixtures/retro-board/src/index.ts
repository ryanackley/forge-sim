import Resolver from '@forge/resolver';
import { getBoard, addItem, submitVote, closeRetro, getSprintInfo } from './resolvers/board.js';
import { processVote, processItem, generateSummary } from './resolvers/consumers.js';
import { onSprintComplete } from './resolvers/triggers.js';

// UI Resolver — multiple definitions for the frontend to invoke
const resolver = new Resolver();
resolver.define('getBoard', getBoard);
resolver.define('addItem', addItem);
resolver.define('submitVote', submitVote);
resolver.define('closeRetro', closeRetro);
resolver.define('getSprintInfo', getSprintInfo);

export const handler = resolver.getDefinitions();

// Consumer exports — each handles events from a specific queue
export { processVote };
export { processItem };
export { generateSummary };

// Trigger export
export { onSprintComplete };
