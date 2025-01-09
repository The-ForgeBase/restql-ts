import { Request } from "express";
import { RestQLConfig, RestQLRequest } from "../types";
import { createRestQL } from "../index";
import { validateQuery, QueryValidationError } from "../queryValidator";

function decodeQuery(queryStr: string): unknown {
  try {
    return JSON.parse(Buffer.from(queryStr, "base64").toString());
  } catch {
    throw new QueryValidationError("Invalid base64 or JSON format");
  }
}

export interface ExpressAdapter {
  toSQL(req: Request): Promise<{ sql: string; params: any[] }>;
}

export function createExpressAdapter(config: RestQLConfig): ExpressAdapter {
  const restql = createRestQL(config);

  return {
    async toSQL(req: Request) {
      let method = req.method;
      let queryOptions = {};
      
      if (method === 'POST' && req.headers['content-type'] === 'application/json') {
        // Handle JSON payload in POST request
        if (req.body && req.body.action && req.body.query) {
          try {
            validateQuery(req.body.query);
            queryOptions = req.body.query;
            method = req.body.action;
          } catch (error) {
            if (error instanceof QueryValidationError) {
              throw error;
            }
            throw new QueryValidationError(error instanceof Error ? error.message : "Unknown error");
          }
        }
      } else {
        // Handle query string parameter
        if (req.query.q) {
          try {
            const decodedQuery = decodeQuery(req.query.q as string);
            validateQuery(decodedQuery);
            queryOptions = decodedQuery;
          } catch (error) {
            if (error instanceof QueryValidationError) {
              throw error;
            }
            throw new QueryValidationError(error instanceof Error ? error.message : "Unknown error");
          }
        }
      }

      const restQLRequest: RestQLRequest = {
        method: method as any,
        path: req.path,
        query: queryOptions,
        body: req.body,
      };

      return restql.toSQL(restQLRequest);
    },
  };
}
