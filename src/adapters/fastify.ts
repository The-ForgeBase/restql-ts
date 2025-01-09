import { FastifyRequest } from "fastify";
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

export interface FastifyAdapter {
  toSQL(req: FastifyRequest): Promise<{ sql: string; params: any[] }>;
}

export function createFastifyAdapter(config: RestQLConfig): FastifyAdapter {
  const restql = createRestQL(config);

  return {
    async toSQL(req: FastifyRequest) {
      let method = req.method;
      let queryOptions = {};

      // Parse query parameters
      const query = req.query as Record<string, string>;
      if (query.q) {
        try {
          const decodedQuery = decodeQuery(query.q);
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
      // Parse JSON body for POST requests
      else if (method === "POST" && req.body && typeof req.body === "object") {
        const body = req.body as Record<string, any>;
        if (body.action && body.query && body.action) {
          try {
            validateQuery(body.query);
            queryOptions = body.query;
            method = body.action;
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
        path: req.url,
        query: queryOptions,
        body: req.body,
      };

      return restql.toSQL(restQLRequest);
    },
  };
}
