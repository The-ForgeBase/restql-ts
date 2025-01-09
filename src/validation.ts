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
  } = options;

  // Validate and sanitize select fields
  const select = validateAndSanitizeFields(
    maxSelectFields,
    "select",
    allowedFieldPattern,
    query.select
  );

  // Validate and sanitize joins
  const joins = query.joins?.map((join) =>
    validateJoinCondition(allowedFieldPattern, join, {
      allowedOperators,
      allowedLogicalOperators,
    })
  );

  // Validate and sanitize where clauses
  const where = query.where?.map((clause) =>
    validateAndSanitizeWhereClause(clause, {
      depth: 0,
      maxDepth: maxQueryDepth,
      maxConditions: maxConditionsPerGroup,
      allowedOperators,
      allowedLogicalOperators,
      allowedFieldPattern,
    })
  );

  // Validate and sanitize group by fields
  const groupBy = validateAndSanitizeFields(
    maxGroupByFields,
    "groupBy",
    allowedFieldPattern,
    query.groupBy
  );

  // Validate and sanitize having clauses
  const having = query.having?.map((clause) =>
    validateAndSanitizeWhereClause(clause, {
      depth: 0,
      maxDepth: maxQueryDepth,
      maxConditions: maxConditionsPerGroup,
      allowedOperators,
      allowedLogicalOperators,
      allowedFieldPattern,
    })
  );

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
    if (!allowedFieldPattern.test(field)) {
      throw new ValidationError(
        `Invalid field name "${field}". Must contain only alphanumeric characters, underscores, and dots`
      );
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
  }
): WhereCondition {
  if (!allowedFieldPattern.test(condition.field)) {
    throw new ValidationError(
      `Invalid field name "${condition.field}". Must contain only alphanumeric characters, underscores, and dots`
    );
  }

  if (
    context.allowedOperators &&
    !context.allowedOperators.includes(condition.operator)
  ) {
    throw new ValidationError(
      `Operator "${condition.operator}" is not allowed`
    );
  }

  return condition;
}

function validateJoinCondition(
  allowedFieldPattern: RegExp,
  join: JoinCondition,
  context: {
    allowedOperators?: Operator[];
    allowedLogicalOperators?: LogicalOperator[];
  }
): JoinCondition {
  if (!allowedFieldPattern.test(join.table)) {
    throw new ValidationError(
      `Invalid table name "${join.table}". Must contain only alphanumeric characters, underscores, and dots`
    );
  }

  if (join.alias && !allowedFieldPattern.test(join.alias)) {
    throw new ValidationError(
      `Invalid alias "${join.alias}". Must contain only alphanumeric characters, underscores, and dots`
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
