import { Request } from "express";
import { createExpressAdapter } from "../adapters/express";
import { QueryValidationError } from "../queryValidator";

describe("Express Adapter", () => {
  const adapter = createExpressAdapter({
    dialect: "postgres",
  });

  function createMockRequest(options: {
    method?: string;
    path?: string;
    query?: Record<string, any>;
    body?: any;
  }): Request {
    const {
      method = "GET",
      path = "/users",
      query = {},
      body = undefined,
    } = options;
    return {
      method,
      path,
      query,
      body,
    } as Request;
  }

  function encodeQuery(query: any): string {
    return Buffer.from(JSON.stringify(query)).toString("base64");
  }

  describe("SELECT queries", () => {
    it("should generate simple SELECT query", async () => {
      const req = createMockRequest({
        query: {
          q: encodeQuery({
            select: ["id", "name", "email"],
          }),
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toBe('SELECT "id", "name", "email" FROM "users"');
      expect(result.params).toEqual([]);
    });

    it("should handle WHERE conditions", async () => {
      const req = createMockRequest({
        query: {
          q: encodeQuery({
            select: ["*"],
            where: {
              operator: "AND",
              conditions: [
                { field: "age", operator: ">", value: 18 },
                { field: "status", operator: "=", value: "active" },
              ],
            },
          }),
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/WHERE "age" > \$1 AND "status" = \$2/);
      expect(result.params).toEqual([18, "active"]);
    });
  });

  describe("Mutations", () => {
    it("should handle INSERT", async () => {
      const req = createMockRequest({
        method: "POST",
        body: {
          name: "John",
          email: "john@example.com",
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/INSERT INTO "users"/);
      expect(result.params).toEqual(["John", "john@example.com"]);
    });

    it("should handle UPDATE", async () => {
      const req = createMockRequest({
        method: "PUT",
        path: "/users/1",
        body: {
          name: "Updated Name",
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/UPDATE "users" SET/);
      expect(result.sql).toMatch(/WHERE "id" = \$2/);
      expect(result.params).toEqual(["Updated Name", "1"]);
    });

    it("should handle DELETE", async () => {
      const req = createMockRequest({
        method: "DELETE",
        path: "/users/1",
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/DELETE FROM "users"/);
      expect(result.sql).toMatch(/WHERE "id" = \$1/);
      expect(result.params).toEqual(["1"]);
    });
  });

  describe("Error handling", () => {
    it("should handle malformed base64", async () => {
      const req = createMockRequest({
        query: { q: "invalid-base64" },
      });

      await expect(adapter.toSQL(req)).rejects.toThrow(QueryValidationError);
    });

    it("should handle invalid JSON", async () => {
      const req = createMockRequest({
        query: {
          q: Buffer.from("{invalid-json}").toString("base64"),
        },
      });

      await expect(adapter.toSQL(req)).rejects.toThrow(QueryValidationError);
    });

    it("should validate query structure", async () => {
      const req = createMockRequest({
        query: {
          q: encodeQuery({
            select: "invalid-select", // should be an array
          }),
        },
      });

      await expect(adapter.toSQL(req)).rejects.toThrow(
        "select must be an array of strings"
      );
    });
  });
});
