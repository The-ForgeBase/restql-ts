export type SQLDialect = "mysql" | "postgres" | "sqlite";

export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL";

export interface JoinCondition {
  type: JoinType;
  table: string;
  alias?: string;
  on: WhereClause[];
}

export interface RestQLConfig {
  dialect: SQLDialect;
  schema?: string;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface RestQLRequest {
  method: HttpMethod;
  path: string;
  body?: any;
  query?: Record<string, string> | any;
}

export interface RestQLResponse {
  sql: string;
  params: any[];
}

export type Operator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "LIKE"
  | "NOT LIKE"
  | "IN"
  | "NOT IN"
  | "IS NULL"
  | "IS NOT NULL"
  | "BETWEEN"
  | "REGEXP"
  | "NOT REGEXP";

export type LogicalOperator = "AND" | "OR";

export interface WhereCondition {
  field: string;
  operator: Operator;
  value: any;
}

export interface WhereGroup {
  operator: LogicalOperator;
  conditions: (WhereCondition | WhereGroup)[];
  not?: boolean;
}

export type WhereClause = WhereCondition | WhereGroup;

export interface OrderByClause {
  field: string;
  direction: "ASC" | "DESC";
}

export interface Pagination {
  limit?: number;
  offset?: number;
}

export interface QueryOptions extends Pagination {
  select?: string[];
  where?: WhereClause[];
  joins?: JoinCondition[];
  orderBy?: OrderByClause[];
  groupBy?: string[];
  having?: WhereClause[];
}

export interface ParsedRequest {
  operation: "CREATE" | "READ" | "UPDATE" | "DELETE";
  table: string;
  fields?: string[];
  where?: WhereClause[];
  joins?: JoinCondition[];
  orderBy?: OrderByClause[];
  groupBy?: string[];
  having?: WhereClause[];
  limit?: number;
  offset?: number;
  values?: Record<string, any>[];
}
