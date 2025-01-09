import { RestQLRequest, ParsedRequest, QueryOptions } from "./types";
import { parseQuery } from "./queryParser";
import { ValidationOptions } from "./validation";

export function parseRequest(
  request: RestQLRequest,
  validationOptions?: ValidationOptions
): ParsedRequest {
  const { method, path, query, body } = request;
  const pathParts = path.split("/").filter(Boolean);
  const table = pathParts[0];
  const id = pathParts[1];

  // Use the decoded query directly
  const queryOptions = query as unknown as QueryOptions;

  switch (method) {
    case "POST":
      return {
        operation: "CREATE",
        table,
        values: Array.isArray(body) ? body : [body],
      };

    case "GET": {
      const { select, where, ...restOptions } = queryOptions;
      const parsed: ParsedRequest = {
        operation: "READ",
        table,
        fields: select || ["*"],
        where: where ? (Array.isArray(where) ? where : [where]) : undefined,
        ...restOptions,
      };

      if (id && id !== "list") {
        parsed.where = [{ field: "id", operator: "=", value: id }];
        parsed.limit = 1;
      }

      return parsed;
    }

    case "PUT":
      if (id) {
        return {
          operation: "UPDATE",
          table,
          values: [{ ...body, id }],
          where: [{ field: "id", operator: "=", value: id }],
        };
      }
      return {
        operation: "UPDATE",
        table,
        values: body,
      };

    case "DELETE":
      if (id) {
        return {
          operation: "DELETE",
          table,
          where: [{ field: "id", operator: "=", value: id }],
        };
      }
      return {
        operation: "DELETE",
        table,
        where: body.map((item: any) => ({
          field: "id",
          operator: "=",
          value: item.id,
        })),
      };

    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }
}
