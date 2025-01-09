import { QueryOptions, WhereClause, OrderByClause } from "./types";
import {
  validateAndSanitizeQuery,
  ValidationOptions,
  ValidationError,
} from "./validation";

/**
 * Parses a query string into QueryOptions
 * Example query:
 * {
 *   "select": ["id", "name", "email"],
 *   "where": {
 *     "operator": "AND",
 *     "conditions": [
 *       { "field": "age", "operator": ">", "value": 18 },
 *       {
 *         "operator": "OR",
 *         "conditions": [
 *           { "field": "city", "operator": "=", "value": "New York" },
 *           { "field": "city", "operator": "=", "value": "Los Angeles" }
 *         ]
 *       }
 *     ]
 *   },
 *   "orderBy": [{ "field": "createdAt", "direction": "DESC" }],
 *   "groupBy": ["department"],
 *   "having": [{ "field": "count", "operator": ">", "value": 5 }],
 *   "limit": 10,
 *   "offset": 0
 * }
 */
export function parseQuery(
  queryStr?: string,
  validationOptions?: ValidationOptions
): QueryOptions {
  if (!queryStr) {
    return {};
  }

  try {
    // Decode the base64 query string and parse it
    const decodedStr = Buffer.from(queryStr, "base64").toString();
    const query = JSON.parse(decodedStr);

    // Validate and sanitize the query
    return validateAndSanitizeQuery(query, validationOptions);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error(
      `Invalid query format: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function parseWhereClauses(where: any): WhereClause[] | undefined {
  if (!where) {
    return undefined;
  }

  if (Array.isArray(where)) {
    return where.map(parseWhereClause);
  }

  return [parseWhereClause(where)];
}

function parseWhereClause(clause: any): WhereClause {
  if (!clause || typeof clause !== "object") {
    throw new Error("Invalid where clause");
  }

  if ("operator" in clause && "conditions" in clause) {
    return {
      operator: clause.operator,
      conditions: clause.conditions.map(parseWhereClause),
      not: clause.not,
    };
  }

  if ("field" in clause && "operator" in clause) {
    return {
      field: clause.field,
      operator: clause.operator,
      value: clause.value,
    };
  }

  throw new Error("Invalid where clause structure");
}

function parseOrderBy(orderBy: any): OrderByClause[] | undefined {
  if (!orderBy) {
    return undefined;
  }

  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return orders.map((order) => ({
    field: order.field,
    direction: order.direction?.toUpperCase() === "DESC" ? "DESC" : "ASC",
  }));
}
