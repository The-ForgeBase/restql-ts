import { RestQLRequest } from "../types";
import { createRestQL, RestQLOptions } from "../index";
import { validateQuery, QueryValidationError } from "../queryValidator";

function decodeQuery(queryStr: string): any {
  try {
    return JSON.parse(Buffer.from(queryStr, "base64").toString());
  } catch {
    throw new QueryValidationError("Invalid base64 or JSON format");
  }
}

export interface WebAdapter {
  toSQL(req: Request): Promise<{ sql: string; params: any[] }>;
}

export function createWebAdapter(
  config: RestQLOptions,
  { enableJsonPayloads = false }: { enableJsonPayloads?: boolean } = {}
): WebAdapter {
  const restql = createRestQL(config);

  return {
    async toSQL(req: Request) {
      const url = new URL(req.url);
      let method = req.method;
      let queryOptions: any = {};

      // Parse query parameters
      if (url.searchParams.has("q")) {
        const queryStr = url.searchParams.get("q")!;
        try {
          const decodedQuery = decodeQuery(queryStr);
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

      // Parse body if present
      let body: any;

      if (method !== "GET" && method !== "HEAD") {
        const contentType = req.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          body = await req.json();
        }
      }

      if (enableJsonPayloads && method === "POST" && body.query) {
        try {
          const { query, action } = body as {
            query: any;
            action: string;
          };

          // console.log("body", body);

          // Use action from JSON payload as query if present
          if (query && (action == "get" || action == "GET")) {
            validateQuery(query);
            queryOptions = query;
            method = action.toUpperCase();
            body = {};
          }
        } catch (error) {
          if (error instanceof QueryValidationError) {
            throw error;
          }
          throw new QueryValidationError(
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }

      const restQLRequest: RestQLRequest = {
        method: method as any,
        path: url.pathname,
        query: queryOptions,
        body,
      };

      return restql.toSQL(restQLRequest);
    },
  };
}
