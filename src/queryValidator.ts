import {
  QueryOptions,
  WhereClause,
  OrderByClause,
  JoinCondition,
  Operator,
} from "./types";

export class QueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryValidationError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateWhereClause(where: unknown): where is WhereClause {
  if (!isObject(where)) return false;

  if ("operator" in where && "conditions" in where) {
    if (
      typeof where.operator !== "string" ||
      !Array.isArray(where.conditions)
    ) {
      return false;
    }
    return where.conditions.every(validateWhereClause);
  }

  if ("field" in where && "operator" in where && "value" in where) {
    return (
      typeof where.field === "string" && typeof where.operator === "string"
    );
  }

  return false;
}

function validateOrderBy(orderBy: unknown): orderBy is OrderByClause {
  if (!isObject(orderBy)) return false;
  return (
    "field" in orderBy &&
    "direction" in orderBy &&
    typeof orderBy.field === "string" &&
    (orderBy.direction === "ASC" || orderBy.direction === "DESC")
  );
}

function validateJoin(join: unknown): join is JoinCondition {
  if (!isObject(join)) return false;
  return (
    "type" in join &&
    "table" in join &&
    "on" in join &&
    typeof join.table === "string" &&
    Array.isArray(join.on) &&
    join.on.every(validateWhereClause)
  );
}

export function validateQuery(query: unknown): asserts query is QueryOptions {
  if (!isObject(query)) {
    throw new QueryValidationError("Query must be an object");
  }

  // Validate select
  if ("select" in query && query.select !== undefined) {
    if (
      !Array.isArray(query.select) ||
      !query.select.every((f) => typeof f === "string")
    ) {
      throw new QueryValidationError("select must be an array of strings");
    }
  }

  // Validate where
  if ("where" in query && query.where !== undefined) {
    if (Array.isArray(query.where)) {
      if (!query.where.every(validateWhereClause)) {
        throw new QueryValidationError("Invalid where clause structure");
      }
    } else if (!validateWhereClause(query.where)) {
      throw new QueryValidationError("Invalid where clause structure");
    }
  }

  // Validate joins
  if ("joins" in query && query.joins !== undefined) {
    if (!Array.isArray(query.joins) || !query.joins.every(validateJoin)) {
      throw new QueryValidationError("Invalid joins structure");
    }
  }

  // Validate orderBy
  if ("orderBy" in query && query.orderBy !== undefined) {
    if (
      !Array.isArray(query.orderBy) ||
      !query.orderBy.every(validateOrderBy)
    ) {
      throw new QueryValidationError("Invalid orderBy structure");
    }
  }

  // Validate groupBy
  if ("groupBy" in query && query.groupBy !== undefined) {
    if (
      !Array.isArray(query.groupBy) ||
      !query.groupBy.every((f) => typeof f === "string")
    ) {
      throw new QueryValidationError("groupBy must be an array of strings");
    }
  }

  // Validate having
  if ("having" in query && query.having !== undefined) {
    if (
      !Array.isArray(query.having) ||
      !query.having.every(validateWhereClause)
    ) {
      throw new QueryValidationError("Invalid having clause structure");
    }
  }

  // Validate limit and offset
  if ("limit" in query && query.limit !== undefined) {
    if (typeof query.limit !== "number" || query.limit < 0) {
      throw new QueryValidationError("limit must be a non-negative number");
    }
  }

  if ("offset" in query && query.offset !== undefined) {
    if (typeof query.offset !== "number" || query.offset < 0) {
      throw new QueryValidationError("offset must be a non-negative number");
    }
  }

  // if any of the above is not in the query, throw an error
  if (Object.keys(query).length === 0) {
    throw new QueryValidationError("Query is empty");
  }

  // if the query is not empty, but contains non-query options, throw an error
  if (
    Object.keys(query).some(
      (key) =>
        ![
          "select",
          "where",
          "joins",
          "orderBy",
          "groupBy",
          "having",
          "limit",
          "offset",
        ].includes(key)
    )
  ) {
    throw new QueryValidationError("Invalid query options");
  }
}
