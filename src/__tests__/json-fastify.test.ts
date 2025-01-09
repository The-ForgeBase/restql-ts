import { FastifyRequest } from "fastify";
import { createFastifyAdapter } from "../adapters/fastify";
import { QueryValidationError } from "../queryValidator";

describe("JSON Express Adapter", () => {
  const adapter = createFastifyAdapter(
    {
      dialect: "postgres",
    },
    { enableJsonPayloads: true }
  );

  function createMockRequest(options: {
    method?: string;
    url?: string;
    query?: Record<string, any>;
    body?: any;
  }): FastifyRequest {
    const {
      method = "GET",
      url = "/users",
      query = {},
      body = undefined,
    } = options;
    return {
      method,
      url,
      query,
      body,
    } as FastifyRequest;
  }

  describe("SELECT queries", () => {
    it("should generate simple SELECT query", async () => {
      const req = createMockRequest({
        method: "POST",
        body: {
          query: {
            select: ["id", "name", "email"],
          },
          action: "get",
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toBe('SELECT "id", "name", "email" FROM "users"');
      expect(result.params).toEqual([]);
    });

    it("should handle WHERE conditions", async () => {
      const req = createMockRequest({
        method: "POST",
        body: {
          query: {
            select: ["*"],
            where: {
              operator: "AND",
              conditions: [
                { field: "age", operator: ">", value: 18 },
                { field: "status", operator: "=", value: "active" },
              ],
            },
          },
          action: "get",
        },
      });

      const result = await adapter.toSQL(req);
      // console.log(result.sql);
      expect(result.sql).toMatch(/WHERE "age" > \$1 AND "status" = \$2/);
      expect(result.params).toEqual([18, "active"]);
    });

    it("should handle complex JOINs", async () => {
      const req = createMockRequest({
        method: "POST",
        body: {
          query: {
            select: ["users.id", "orders.total"],
            joins: [
              {
                type: "LEFT",
                table: "orders",
                on: [
                  { field: "users.id", operator: "=", value: "orders.user_id" },
                ],
              },
            ],
          },
          action: "get",
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/LEFT JOIN "orders"/);
      expect(result.sql).toMatch(/ON "users"."id" = "orders"."user_id"/);
    });

    it("should handle complex JOINs with WHERE GROUP", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/users",
        body: {
          query: {
            select: ["users.id", "orders.total"],
            joins: [
              {
                type: "LEFT",
                table: "orders",
                on: [
                  { field: "users.id", operator: "=", value: "orders.user_id" },
                ],
              },
            ],
            where: {
              operator: "AND",
              conditions: [
                { field: "orders.total", operator: ">", value: 100 },
                { field: "users.id", operator: "=", value: 1 },
              ],
            },
          },
          action: "get",
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/LEFT JOIN "orders"/);
      expect(result.sql).toMatch(/ON "users"."id" = "orders"."user_id"/);
      expect(result.sql).toMatch(
        /WHERE "orders"."total" > \$1 AND "users"."id" = \$2/
      );
      expect(result.params).toEqual([100, 1]);
    });

    it("should handle complex JOINs with WHERE", async () => {
      const req = createMockRequest({
        url: "/users",
        method: "POST",
        body: {
          query: {
            select: ["users.id", "orders.total"],
            joins: [
              {
                type: "LEFT",
                table: "orders",
                on: [
                  { field: "users.id", operator: "=", value: "orders.user_id" },
                ],
              },
            ],
            where: {
              field: "orders.total",
              operator: ">",
              value: 100,
            },
          },
          action: "get",
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/LEFT JOIN "orders"/);
      expect(result.sql).toMatch(/ON "users"."id" = "orders"."user_id"/);
      expect(result.sql).toMatch(/WHERE "orders"."total" > \$1/);
      expect(result.params).toEqual([100]);
    });

    it("should handle GROUP BY and HAVING", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/orders",
        body: {
          query: {
            select: ["user_id", "COUNT(*) as order_count"],
            groupBy: ["user_id"],
            having: [{ field: "COUNT(*)", operator: ">", value: 5 }],
          },
          action: "get",
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/GROUP BY "user_id"/);
      expect(result.sql).toMatch(/HAVING "COUNT\(\*\)" > \$1/);
      expect(result.params).toEqual([5]);
    });

    it("should handle ORDER BY and pagination", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/users",
        body: {
          query: {
            select: ["*"],
            orderBy: [{ field: "created_at", direction: "DESC" }],
            limit: 10,
            offset: 20,
          },
          action: "get",
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/ORDER BY "created_at" DESC/);
      expect(result.sql).toMatch(/LIMIT 10/);
      expect(result.sql).toMatch(/OFFSET 20/);
    });

    describe("WHERE groups", () => {
      it("should handle simple WHERE group", async () => {
        const req = createMockRequest({
          method: "POST",
          url: "/users",
          body: {
            query: {
              where: {
                operator: "AND",
                conditions: [
                  { field: "age", operator: ">", value: 18 },
                  { field: "status", operator: "=", value: "active" },
                ],
              },
            },
            action: "get",
          },
        });

        const result = await adapter.toSQL(req);
        expect(result.sql).toMatch(/WHERE "age" > \$1 AND "status" = \$2/);
        expect(result.params).toEqual([18, "active"]);
      });

      it("should handle simple OR group", async () => {
        const req = createMockRequest({
          method: "POST",
          url: "/users",
          body: {
            query: {
              where: {
                operator: "OR",
                conditions: [
                  { field: "status", operator: "=", value: "active" },
                  { field: "status", operator: "=", value: "pending" },
                ],
              },
            },
            action: "get",
          },
        });

        const result = await adapter.toSQL(req);
        expect(result.sql).toMatch(
          /WHERE \("status" = \$1 OR "status" = \$2\)/
        );
        expect(result.params).toEqual(["active", "pending"]);
      });

      it("should handle nested WHERE groups", async () => {
        const req = createMockRequest({
          method: "POST",
          url: "/users",
          body: {
            query: {
              where: {
                operator: "OR",
                conditions: [
                  { field: "status", operator: "=", value: "active" },
                  {
                    operator: "AND",
                    conditions: [
                      { field: "age", operator: ">", value: 18 },
                      { field: "type", operator: "=", value: "premium" },
                    ],
                  },
                ],
              },
            },
            action: "get",
          },
        });

        const result = await adapter.toSQL(req);
        expect(result.sql).toMatch(
          /WHERE \("status" = \$1 OR \("age" > \$2 AND "type" = \$3\)\)/
        );
        expect(result.params).toEqual(["active", 18, "premium"]);
      });

      it("should handle NOT WHERE group", async () => {
        const req = createMockRequest({
          method: "POST",
          url: "/users",
          body: {
            query: {
              where: {
                operator: "AND",
                conditions: [
                  { field: "status", operator: "=", value: "deleted" },
                  { field: "type", operator: "=", value: "temporary" },
                ],
                not: true,
              },
            },
            action: "get",
          },
        });

        const result = await adapter.toSQL(req);
        expect(result.sql).toMatch(
          /WHERE NOT \("status" = \$1 AND "type" = \$2\)/
        );
        expect(result.params).toEqual(["deleted", "temporary"]);
      });

      it("should handle complex nested WHERE groups with NOT", async () => {
        const req = createMockRequest({
          method: "POST",
          url: "/users",
          body: {
            query: {
              where: {
                operator: "OR",
                conditions: [
                  { field: "status", operator: "=", value: "active" },
                  {
                    operator: "AND",
                    conditions: [
                      { field: "age", operator: ">", value: 18 },
                      {
                        operator: "OR",
                        conditions: [
                          { field: "type", operator: "=", value: "premium" },
                          { field: "type", operator: "=", value: "vip" },
                        ],
                        not: true,
                      },
                    ],
                  },
                ],
              },
            },
            action: "get",
          },
        });

        const result = await adapter.toSQL(req);
        expect(result.sql).toMatch(
          /WHERE \("status" = \$1 OR \("age" > \$2 AND NOT \("type" = \$3 OR "type" = \$4\)\)\)/
        );
        expect(result.params).toEqual(["active", 18, "premium", "vip"]);
      });

      it("should handle WHERE groups with JOIN conditions", async () => {
        const req = createMockRequest({
          method: "POST",
          url: "/users",
          body: {
            query: {
              select: ["users.id", "orders.total"],
              joins: [
                {
                  type: "LEFT",
                  table: "orders",
                  on: [
                    {
                      field: "users.id",
                      operator: "=",
                      value: "orders.user_id",
                    },
                  ],
                },
              ],
              where: {
                operator: "AND",
                conditions: [
                  {
                    operator: "OR",
                    conditions: [
                      { field: "orders.total", operator: ">", value: 1000 },
                      { field: "orders.status", operator: "=", value: "vip" },
                    ],
                  },
                  { field: "users.active", operator: "=", value: true },
                ],
              },
            },
            action: "get",
          },
        });

        const result = await adapter.toSQL(req);
        expect(result.sql).toMatch(/LEFT JOIN "orders"/);
        expect(result.sql).toMatch(/ON "users"."id" = "orders"."user_id"/);
        expect(result.sql).toMatch(
          /WHERE \("orders"."total" > \$1 OR "orders"."status" = \$2\) AND "users"."active" = \$3/
        );
        expect(result.params).toEqual([1000, "vip", true]);
      });
    });
  });

  describe("Mutations", () => {
    it("should handle INSERT", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/users",
        body: {
          name: "John",
          email: "john@example.com",
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/INSERT INTO "users"/);
      expect(result.params).toEqual(["John", "john@example.com"]);
    });

    it("should handle bulk INSERT", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/users",
        body: [
          { name: "John", email: "john@example.com" },
          { name: "Jane", email: "jane@example.com" },
        ],
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/INSERT INTO "users"/);
      expect(result.sql).toMatch(/VALUES \(\$1, \$2\), \(\$3, \$4\)/);
      expect(result.params).toHaveLength(4);
    });

    it("should handle UPDATE", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/users/1",
        body: {
          name: "Updated Name",
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/UPDATE "users" SET/);
      expect(result.sql).toMatch(/WHERE "id" = \$2/);
      expect(result.params).toEqual(["Updated Name", "1"]);
    });

    it("should handle bulk UPDATE", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/users",
        body: [
          { id: 1, status: "active" },
          { id: 2, status: "inactive" },
        ],
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/UPDATE "users" SET/);
      expect(result.sql).toMatch(/CASE/);
      expect(result.params).toHaveLength(4);
    });

    it("should handle DELETE", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/users/1",
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/DELETE FROM "users"/);
      expect(result.sql).toMatch(/WHERE "id" = \$1/);
      expect(result.params).toEqual(["1"]);
    });

    it("should handle bulk DELETE", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/users",
        body: [{ id: 1 }, { id: 2 }],
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/DELETE FROM "users"/);
      expect(result.sql).toMatch(/WHERE "id" = ANY\(\$1\)/);
      expect(result.params).toEqual([[1, 2]]);
    });
  });

  describe("Error handling", () => {
    it("should handle malformed base64", async () => {
      const req = createMockRequest({
        url: "/users",
        method: "POST",
        body: {
          query: { q: "invalid-base64" },
          action: "get",
        },
      });

      await expect(adapter.toSQL(req)).rejects.toThrow(QueryValidationError);
    });

    it("should handle invalid JSON", async () => {
      const req = createMockRequest({
        url: "/users",
        method: "POST",
        body: {
          query: {
            q: Buffer.from("{invalid-json}").toString("base64"),
          },
          action: "get",
        },
      });

      await expect(adapter.toSQL(req)).rejects.toThrow(QueryValidationError);
    });

    it("should validate query structure", async () => {
      const req = createMockRequest({
        url: "/users",
        method: "POST",
        body: {
          query: {
            select: "invalid-select", // should be an array
          },
          action: "get",
        },
      });

      await expect(adapter.toSQL(req)).rejects.toThrow(
        "select must be an array of strings"
      );
    });

    it("should validate where clause structure", async () => {
      const req = createMockRequest({
        url: "/users",
        method: "POST",
        body: {
          query: {
            where: {
              field: "status",
              value: "active",
              // missing operator
            },
          },
          action: "get",
        },
      });

      await expect(adapter.toSQL(req)).rejects.toThrow(
        "Invalid where clause structure"
      );
    });

    it("should validate join structure", async () => {
      const req = createMockRequest({
        url: "/users",
        method: "POST",
        body: {
          query: {
            joins: [
              {
                table: "orders",
                // missing type and on
              },
            ],
          },
          action: "get",
        },
      });

      await expect(adapter.toSQL(req)).rejects.toThrow(
        "Invalid joins structure"
      );
    });
  });
});
