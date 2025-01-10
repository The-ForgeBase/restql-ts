export * from "./types";
export * from "./parser";
export * from "./sqlBuilder";
export * from "./adapters";
export * from "./validation";

import { RestQLConfig, RestQLRequest, RestQLResponse } from "./types";
import { parseRequest } from "./parser";
import { SQLBuilder } from "./sqlBuilder";
import {
  SAFE_FIELD_PATTERN,
  ValidationOptions,
  validateAndSanitizeQuery,
} from "./validation";
import { QueryValidationError } from "./queryValidator";
import { Operator, LogicalOperator } from "./types";

export interface RestQLOptions extends RestQLConfig {
  validation?: ValidationOptions;
}

export function createRestQL(options: RestQLOptions) {
  const { validation, ...config } = options;
  const sqlBuilder = new SQLBuilder(config);

  return {
    /**
     * Convert a REST request to a SQL query
     * @param request The REST request to convert
     * @returns The SQL query and parameters
     */
    toSQL(request: RestQLRequest): RestQLResponse {
      const parsedRequest = parseRequest(request, validation);
      return sqlBuilder.build(parsedRequest);
    },
  };
}

export function encodeQuery(query: any): string {
  return Buffer.from(JSON.stringify(query)).toString("base64");
}

export function decodeQuery(queryStr: string): unknown {
  try {
    return JSON.parse(Buffer.from(queryStr, "base64").toString());
  } catch {
    throw new QueryValidationError("Invalid base64 or JSON format");
  }
}

export const defaultValidationOptions: ValidationOptions = {
  maxQueryDepth: 5,
  maxConditionsPerGroup: 5,
  maxSelectFields: 20,
  maxGroupByFields: 5,
  allowedOperators: [
    "=",
    "!=",
    ">",
    "<",
    ">=",
    "<=",
    "LIKE",
    "NOT LIKE",
    "IN",
    "NOT IN",
    "IS NULL",
    "IS NOT NULL",
    "BETWEEN",
    "REGEXP",
    "NOT REGEXP",
  ] as Operator[],
  allowedLogicalOperators: ["AND", "OR"] as LogicalOperator[],
  allowedFieldPattern: SAFE_FIELD_PATTERN,
  maxValueLength: 1000,
  preventSqlKeywords: true,
};
