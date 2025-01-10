import { Request } from "express";
import { RestQLRequest } from "../types";
import { createRestQL, RestQLOptions } from "../index";
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

export function createExpressAdapter(
  config: RestQLOptions,
  { enableJsonPayloads = false }: { enableJsonPayloads?: boolean } = {}
): ExpressAdapter {
  const restql = createRestQL(config);

  return {
    async toSQL(req: Request) {
      let method = req.method;
      let queryOptions = {};

      // Handle query string parameter
      if (req.query && req.query.q) {
        try {
          const decodedQuery = decodeQuery(req.query.q as string);
          validateQuery(decodedQuery);
          queryOptions = decodedQuery;
        } catch (error) {
          if (error instanceof QueryValidationError) {
            throw error;
          }
          throw new QueryValidationError(
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }
      let body: any;

      if (method !== "GET" && method !== "HEAD") {
        body = req.body as any;
        try {
          body = JSON.parse(body);
        } catch (error) {
          // throw new QueryValidationError("Invalid JSON payload");
        }
      }

      if (method === "POST" && enableJsonPayloads && body) {
        // Handle JSON payload in POST request
        // console.log("body", body);
        if (body.query && (body.action == "get" || body.action == "GET")) {
          try {
            validateQuery(body.query);
            queryOptions = body.query;
            method = body.action.toUpperCase();
            body = {};
          } catch (error) {
            if (error instanceof QueryValidationError) {
              throw error;
            }
            throw new QueryValidationError(
              error instanceof Error ? error.message : "Unknown error"
            );
          }
        }
      }

      const restQLRequest: RestQLRequest = {
        method: method as any,
        path: req.path,
        query: queryOptions,
        body: body,
      };

      return restql.toSQL(restQLRequest);
    },
  };
}
