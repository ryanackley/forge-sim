/**
 * Translation layer between the MCP `forge_entity_query` tool arguments and the
 * KVS entity-store wire protocol (`/api/v1/entity/query`).
 *
 * The MCP tool speaks a flattened dialect (scalar `value`, flat `filters` array
 * plus a separate `filterOperator`) for ergonomics. The wire protocol — which is
 * the tested, canonical contract shared with the `@forge/kvs` entity query
 * builder — expects:
 *
 *   range:   { condition, values: any[] }           (values is ALWAYS an array)
 *   filters: { and: FilterItem[] } | { or: FilterItem[] }
 *   item:    { property, condition, values: any[] }
 *
 * Eval-7 F1: the previous inline translation put scalar range operands in a
 * singular `value` key (the matcher only reads `values`), and sent filters as a
 * bare array with `field`/`value` keys (the wire only reads `.and`/`.or` with
 * `property`/`values`) — both were silent no-ops. This module is the single
 * source of truth for the translation, exported so tests can pin it directly
 * and round-trip it through the real wire handler.
 */

/** Range operators accepted by the MCP tool (matches kvs matchCondition support). */
export const MCP_RANGE_OPERATORS = [
  'BETWEEN',
  'BEGINS_WITH',
  'EQUAL_TO',
  'NOT_EQUAL_TO',
  'GREATER_THAN',
  'GREATER_THAN_EQUAL_TO',
  'LESS_THAN',
  'LESS_THAN_EQUAL_TO',
] as const;

/** Filter operators accepted by the MCP tool (matches kvs matchCondition support). */
export const MCP_FILTER_OPERATORS = [
  'EQUAL_TO',
  'NOT_EQUAL_TO',
  'GREATER_THAN',
  'GREATER_THAN_EQUAL_TO',
  'LESS_THAN',
  'LESS_THAN_EQUAL_TO',
  'BETWEEN',
  'BEGINS_WITH',
  'EXISTS',
  'NOT_EXISTS',
  'CONTAINS',
  'NOT_CONTAINS',
] as const;

export interface McpEntityQueryArgs {
  entityName: string;
  indexName: string;
  partition: any[];
  range?: { operator: string; value?: any };
  filters?: Array<{ field: string; operator: string; value?: any }>;
  filterOperator?: 'AND' | 'OR';
  sort?: 'ASC' | 'DESC';
  cursor?: string;
  limit?: number;
}

/**
 * Normalize an MCP-side operand into the wire's `values` array.
 * BETWEEN passes its [min, max] array through; scalar operators wrap in a
 * one-element array; operand-less operators (EXISTS/NOT_EXISTS) get [].
 */
function toValuesArray(operator: string, value: any): any[] {
  if (operator === 'BETWEEN') return Array.isArray(value) ? value : [value];
  if (value === undefined) return [];
  return [value];
}

/**
 * Build the `/api/v1/entity/query` request body from MCP tool arguments.
 * Pure function — no I/O, safe to unit-test in isolation.
 */
export function buildEntityQueryWireBody(args: McpEntityQueryArgs): any {
  const { entityName, indexName, partition, range, filters, filterOperator, sort, cursor, limit } = args;
  const body: any = { entityName, indexName, partition };

  if (range) {
    body.range = {
      condition: range.operator,
      values: toValuesArray(range.operator, range.value),
    };
  }

  if (filters && filters.length > 0) {
    const items = filters.map((f) => ({
      property: f.field,
      condition: f.operator,
      values: toValuesArray(f.operator, f.value),
    }));
    body.filters = filterOperator === 'OR' ? { or: items } : { and: items };
  }

  if (sort) body.sort = sort;
  if (cursor) body.cursor = cursor;
  if (limit) body.limit = limit;

  return body;
}
