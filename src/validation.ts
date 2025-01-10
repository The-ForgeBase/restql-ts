import {
  QueryOptions,
  WhereClause,
  WhereCondition,
  WhereGroup,
  Operator,
  LogicalOperator,
  OrderByClause,
  JoinCondition,
} from "./types";

const MAX_QUERY_DEPTH = 5;
const MAX_CONDITIONS_PER_GROUP = 10;
const MAX_SELECT_FIELDS = 50;
const MAX_GROUP_BY_FIELDS = 10;
const ALLOWED_FIELD_PATTERN = /^[a-zA-Z0-9_.]+|\*$/;

// Update constants at the top
const SQL_KEYWORDS = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "TRUNCATE",
  "ALTER",
  "CREATE",
  "DATABASE",
  "TABLE",
  "UNION",
  "JOIN",
  "EXEC",
  "EXECUTE",
  "DECLARE",
  "CAST",
  "CONVERT",
  // Add more SQL keywords that could be used in injection
  "INTO",
  "VALUES",
  "WHERE",
  "FROM",
  "GROUP",
  "ORDER",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "SET",
  "EXEC",
  "EXECUTE",
  "SP_",
  "XP_",
].map((k) => k.toLowerCase());

// Make the patterns more strict but allow * for select all
const SAFE_VALUE_PATTERN = /^[^;'"\\\/\-\-]*$/; // Also catch double-dash comments
const SAFE_TABLE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/; // Add length limit
export const SAFE_FIELD_PATTERN =
  /^(\*|[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)$/; // Stricter dot notation

// Add dangerous patterns to check against
const DANGEROUS_PATTERNS = [
  /;\s*$/, // Trailing semicolon
  /--/, // SQL comment
  /\/\*/, // Multi-line comment start
  /\*\//, // Multi-line comment end
  /'\s*OR\s*'\d+'/i, // OR condition injection
  /UNION\s+SELECT/i, // UNION injection
  /SELECT\s+FROM/i, // SELECT injection
  /DROP\s+TABLE/i, // DROP injection
  /DELETE\s+FROM/i, // DELETE injection
  /;\s*DROP/i, // Chained DROP
  /;\s*DELETE/i, // Chained DELETE
];

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface ValidationOptions {
  maxQueryDepth?: number;
  maxConditionsPerGroup?: number;
  maxSelectFields?: number;
  maxGroupByFields?: number;
  allowedOperators?: Operator[];
  allowedLogicalOperators?: LogicalOperator[];
  allowedFieldPattern?: RegExp;
  maxValueLength?: number;
  preventSqlKeywords?: boolean;
}

export function validateAndSanitizeQuery(
  query: QueryOptions,
  options: ValidationOptions = {}
): QueryOptions {
  const {
    maxQueryDepth = MAX_QUERY_DEPTH,
    maxConditionsPerGroup = MAX_CONDITIONS_PER_GROUP,
    maxSelectFields = MAX_SELECT_FIELDS,
    maxGroupByFields = MAX_GROUP_BY_FIELDS,
    allowedOperators,
    allowedLogicalOperators,
    allowedFieldPattern = ALLOWED_FIELD_PATTERN,
    maxValueLength,
    preventSqlKeywords,
  } = options;

  // Validate and sanitize select fields
  const select = validateAndSanitizeFields(
    maxSelectFields,
    "select",
    allowedFieldPattern,
    query.select
  );

  // Validate and sanitize joins
  const joins = query.joins
    ? query.joins.map((join) =>
        validateJoinCondition(allowedFieldPattern, join, {
          allowedOperators,
          allowedLogicalOperators,
          maxValueLength,
          preventSqlKeywords,
        })
      )
    : undefined;

  // Validate and sanitize where clauses
  const where = query.where
    ? Array.isArray(query.where)
      ? query.where.map((clause) =>
          validateAndSanitizeWhereClause(clause, {
            depth: 0,
            maxDepth: maxQueryDepth,
            maxConditions: maxConditionsPerGroup,
            allowedOperators,
            allowedLogicalOperators,
            allowedFieldPattern,
            maxValueLength,
            preventSqlKeywords,
          })
        )
      : [
          validateAndSanitizeWhereClause(query.where, {
            depth: 0,
            maxDepth: maxQueryDepth,
            maxConditions: maxConditionsPerGroup,
            allowedOperators,
            allowedLogicalOperators,
            allowedFieldPattern,
            maxValueLength,
            preventSqlKeywords,
          }),
        ]
    : undefined;

  // Validate and sanitize group by fields
  const groupBy = validateAndSanitizeFields(
    maxGroupByFields,
    "groupBy",
    allowedFieldPattern,
    query.groupBy
  );

  // Validate and sanitize having clauses
  const having = query.having
    ? query.having.map((clause) =>
        validateAndSanitizeWhereClause(clause, {
          depth: 0,
          maxDepth: maxQueryDepth,
          maxConditions: maxConditionsPerGroup,
          allowedOperators,
          allowedLogicalOperators,
          allowedFieldPattern,
          maxValueLength,
          preventSqlKeywords,
        })
      )
    : undefined;

  // Validate and sanitize order by clauses
  const orderBy = validateAndSanitizeOrderBy(
    allowedFieldPattern,
    query.orderBy
  );

  // Validate and sanitize pagination
  const limit = validateAndSanitizeLimit(query.limit);
  const offset = validateAndSanitizeOffset(query.offset);

  return {
    select,
    joins,
    where,
    groupBy,
    having,
    orderBy,
    limit,
    offset,
  };
}

// Update validateAndSanitizeFields function
function validateAndSanitizeFields(
  maxFields: number,
  context: string,
  allowedFieldPattern: RegExp,
  fields?: string[]
): string[] | undefined {
  if (!fields) {
    return undefined;
  }

  if (fields.length > maxFields) {
    throw new ValidationError(
      `Too many ${context} fields. Maximum allowed is ${maxFields}`
    );
  }

  return fields.map((field) => {
    // Allow * for select all
    if (field === "*") {
      return field;
    }

    // Check for dangerous patterns first
    if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(field))) {
      throw new ValidationError(
        `Invalid field name "${field}". Contains dangerous patterns`
      );
    }

    // Check field pattern
    if (!SAFE_FIELD_PATTERN.test(field)) {
      throw new ValidationError(
        `Invalid field name "${field}". Must start with a letter and contain only alphanumeric characters, underscores, and dots`
      );
    }

    // Check for SQL keywords in each part of the field name
    const fieldParts = field.split(".");
    const containsSqlKeyword = fieldParts.some((part) => {
      const lowerPart = part.toLowerCase();
      return SQL_KEYWORDS.some(
        (keyword) =>
          // Check if the part exactly matches a keyword or contains it as a whole word
          lowerPart === keyword ||
          new RegExp(`\\b${keyword}\\b`).test(lowerPart)
      );
    });

    if (containsSqlKeyword) {
      throw new ValidationError(`Field name "${field}" contains SQL keywords`);
    }

    return field;
  });
}

function validateAndSanitizeWhereClause(
  clause: WhereClause,
  context: {
    depth: number;
    maxDepth: number;
    maxConditions: number;
    allowedOperators?: Operator[];
    allowedLogicalOperators?: LogicalOperator[];
    allowedFieldPattern: RegExp;
    maxValueLength?: number;
    preventSqlKeywords?: boolean;
  }
): WhereClause {
  if (context.depth > context.maxDepth) {
    throw new ValidationError(
      `Query too complex. Maximum depth is ${context.maxDepth}`
    );
  }

  if (isWhereGroup(clause)) {
    return validateAndSanitizeWhereGroup(clause, context);
  }

  return validateAndSanitizeWhereCondition(
    context.allowedFieldPattern,
    clause as WhereCondition,
    context
  );
}

function isWhereGroup(clause: WhereClause): clause is WhereGroup {
  return "conditions" in clause;
}

function validateAndSanitizeWhereGroup(
  group: WhereGroup,
  context: {
    depth: number;
    maxDepth: number;
    maxConditions: number;
    allowedOperators?: Operator[];
    allowedLogicalOperators?: LogicalOperator[];
    allowedFieldPattern: RegExp;
    maxValueLength?: number;
    preventSqlKeywords?: boolean;
  }
): WhereGroup {
  if (
    context.allowedLogicalOperators &&
    !context.allowedLogicalOperators.includes(group.operator)
  ) {
    throw new ValidationError(
      `Logical operator "${group.operator}" is not allowed`
    );
  }

  if (group.conditions.length > context.maxConditions) {
    throw new ValidationError(
      `Too many conditions in group. Maximum allowed is ${context.maxConditions}`
    );
  }

  return {
    operator: group.operator,
    conditions: group.conditions.map((condition) =>
      validateAndSanitizeWhereClause(condition, {
        ...context,
        depth: context.depth + 1,
      })
    ),
    not: group.not,
  };
}

function validateAndSanitizeWhereCondition(
  allowedFieldPattern: RegExp,
  condition: WhereCondition,
  context: {
    allowedOperators?: Operator[];
    maxValueLength?: number;
    preventSqlKeywords?: boolean;
  }
): WhereCondition {
  // Validate field name
  if (!allowedFieldPattern.test(condition.field)) {
    throw new ValidationError(
      `Invalid field name "${condition.field}". Must start with a letter and contain only alphanumeric characters, underscores, and dots`
    );
  }

  // Validate operator
  if (
    context.allowedOperators &&
    !context.allowedOperators.includes(condition.operator)
  ) {
    throw new ValidationError(
      `Operator "${condition.operator}" is not allowed`
    );
  }

  // Validate value
  validateValue(condition.value, {
    maxValueLength: context.maxValueLength,
    preventSqlKeywords: context.preventSqlKeywords,
  });

  return condition;
}

function validateJoinCondition(
  allowedFieldPattern: RegExp,
  join: JoinCondition,
  context: {
    allowedOperators?: Operator[];
    allowedLogicalOperators?: LogicalOperator[];
    maxValueLength?: number;
    preventSqlKeywords?: boolean;
  }
): JoinCondition {
  // Validate table name
  if (!SAFE_TABLE_PATTERN.test(join.table)) {
    throw new ValidationError(
      `Invalid table name "${join.table}". Must start with a letter and contain only alphanumeric characters and underscores`
    );
  }

  // Validate alias if present
  if (join.alias && !SAFE_TABLE_PATTERN.test(join.alias)) {
    throw new ValidationError(
      `Invalid alias "${join.alias}". Must start with a letter and contain only alphanumeric characters and underscores`
    );
  }

  return {
    ...join,
    on: join.on.map((clause) =>
      validateAndSanitizeWhereClause(clause, {
        depth: 0,
        maxDepth: MAX_QUERY_DEPTH,
        maxConditions: MAX_CONDITIONS_PER_GROUP,
        allowedOperators: context.allowedOperators,
        allowedLogicalOperators: context.allowedLogicalOperators,
        allowedFieldPattern: allowedFieldPattern,
        maxValueLength: context.maxValueLength,
        preventSqlKeywords: context.preventSqlKeywords,
      })
    ),
  };
}

function validateAndSanitizeOrderBy(
  allowedFieldPattern: RegExp,
  orderBy?: OrderByClause[]
): OrderByClause[] | undefined {
  if (!orderBy) {
    return undefined;
  }

  return orderBy.map((order) => {
    if (!allowedFieldPattern.test(order.field)) {
      throw new ValidationError(
        `Invalid field name "${order.field}". Must contain only alphanumeric characters, underscores, and dots`
      );
    }

    return {
      field: order.field,
      direction: order.direction,
    };
  });
}

function validateAndSanitizeLimit(limit?: number): number | undefined {
  if (limit === undefined) {
    return undefined;
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new ValidationError("Limit must be a positive integer");
  }

  return limit;
}

function validateAndSanitizeOffset(offset?: number): number | undefined {
  if (offset === undefined) {
    return undefined;
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw new ValidationError("Offset must be a non-negative integer");
  }

  return offset;
}

// Update validateValue function to include more checks
function validateValue(
  value: unknown,
  context: {
    maxValueLength?: number;
    preventSqlKeywords?: boolean;
  }
): void {
  if (value === null || value === undefined) {
    return;
  }

  // Check value type
  if (typeof value === "object" && !(value instanceof Date)) {
    throw new ValidationError("Complex objects are not allowed as values");
  }

  // Convert to string for validation
  const strValue = String(value);

  // Check length
  if (context.maxValueLength && strValue.length > context.maxValueLength) {
    throw new ValidationError(
      `Value exceeds maximum length of ${context.maxValueLength}`
    );
  }

  // Check for dangerous patterns
  if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(strValue))) {
    throw new ValidationError("Value contains dangerous patterns");
  }

  // Check for SQL injection patterns
  if (!SAFE_VALUE_PATTERN.test(strValue)) {
    throw new ValidationError("Value contains forbidden characters");
  }

  // Check for SQL keywords if enabled
  if (context.preventSqlKeywords) {
    const lowerValue = strValue.toLowerCase();
    if (
      SQL_KEYWORDS.some((keyword) => lowerValue.includes(keyword)) ||
      lowerValue.includes("select") ||
      lowerValue.includes("delete") ||
      lowerValue.includes("drop")
    ) {
      throw new ValidationError("Value contains SQL keywords");
    }
  }
}
