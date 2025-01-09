import { createWebAdapter } from "../adapters/web";
import { QueryValidationError } from "../queryValidator";

describe("Web Adapter", () => {
  const adapter = createWebAdapter(
    {
      dialect: "postgres",
    },
    { enableJsonPayloads: true }
  );

  function createRequest(
    path: string,
    options: {
      method?: string;
      query?: any;
      body?: any;
    } = {}
  ): Request {
    let { method = "POST", query, body } = options;
    const url = new URL(`http://test.com${path}`);

    if (query && !body) {
      body = { query: query, action: "GET" };
    }

    // console.log("url", url);

    return new Request(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  describe("SELECT queries", () => {
    it("should generate simple SELECT query", async () => {
      const req = createRequest("/users", {
        query: {
          select: ["id", "name", "email"],
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toBe('SELECT "id", "name", "email" FROM "users"');
      expect(result.params).toEqual([]);
    });

    it("should handle WHERE conditions", async () => {
      const req = createRequest("/users", {
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
      });

      const result = await adapter.toSQL(req);
      // console.log(result.sql);
      expect(result.sql).toMatch(/WHERE "age" > \$1 AND "status" = \$2/);
      expect(result.params).toEqual([18, "active"]);
    });

    it("should handle complex JOINs", async () => {
      const req = createRequest("/users", {
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
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/LEFT JOIN "orders"/);
      expect(result.sql).toMatch(/ON "users"."id" = "orders"."user_id"/);
    });

    it("should handle complex JOINs with WHERE GROUP", async () => {
      const req = createRequest("/users", {
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
      const req = createRequest("/users", {
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
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/LEFT JOIN "orders"/);
      expect(result.sql).toMatch(/ON "users"."id" = "orders"."user_id"/);
      expect(result.sql).toMatch(/WHERE "orders"."total" > \$1/);
      expect(result.params).toEqual([100]);
    });

    it("should handle GROUP BY and HAVING", async () => {
      const req = createRequest("/orders", {
        query: {
          select: ["user_id", "COUNT(*) as order_count"],
          groupBy: ["user_id"],
          having: [{ field: "COUNT(*)", operator: ">", value: 5 }],
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/GROUP BY "user_id"/);
      expect(result.sql).toMatch(/HAVING "COUNT\(\*\)" > \$1/);
      expect(result.params).toEqual([5]);
    });

    it("should handle ORDER BY and pagination", async () => {
      const req = createRequest("/users", {
        query: {
          select: ["*"],
          orderBy: [{ field: "created_at", direction: "DESC" }],
          limit: 10,
          offset: 20,
        },
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/ORDER BY "created_at" DESC/);
      expect(result.sql).toMatch(/LIMIT 10/);
      expect(result.sql).toMatch(/OFFSET 20/);
    });

    describe("WHERE groups", () => {
      it("should handle simple WHERE group", async () => {
        const req = createRequest("/users", {
          query: {
            where: {
              operator: "AND",
              conditions: [
                { field: "age", operator: ">", value: 18 },
                { field: "status", operator: "=", value: "active" },
              ],
            },
          },
        });

        const result = await adapter.toSQL(req);
        expect(result.sql).toMatch(/WHERE "age" > \$1 AND "status" = \$2/);
        expect(result.params).toEqual([18, "active"]);
      });

      it("should handle simple OR group", async () => {
        const req = createRequest("/users", {
          query: {
            where: {
              operator: "OR",
              conditions: [
                { field: "status", operator: "=", value: "active" },
                { field: "status", operator: "=", value: "pending" },
              ],
            },
          },
        });

        const result = await adapter.toSQL(req);
        expect(result.sql).toMatch(
          /WHERE \("status" = \$1 OR "status" = \$2\)/
        );
        expect(result.params).toEqual(["active", "pending"]);
      });

      it("should handle nested WHERE groups", async () => {
        const req = createRequest("/users", {
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
        });

        const result = await adapter.toSQL(req);
        expect(result.sql).toMatch(
          /WHERE \("status" = \$1 OR \("age" > \$2 AND "type" = \$3\)\)/
        );
        expect(result.params).toEqual(["active", 18, "premium"]);
      });

      it("should handle NOT WHERE group", async () => {
        const req = createRequest("/users", {
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
        });

        const result = await adapter.toSQL(req);
        expect(result.sql).toMatch(
          /WHERE NOT \("status" = \$1 AND "type" = \$2\)/
        );
        expect(result.params).toEqual(["deleted", "temporary"]);
      });

      it("should handle complex nested WHERE groups with NOT", async () => {
        const req = createRequest("/users", {
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
        });

        const result = await adapter.toSQL(req);
        expect(result.sql).toMatch(
          /WHERE \("status" = \$1 OR \("age" > \$2 AND NOT \("type" = \$3 OR "type" = \$4\)\)\)/
        );
        expect(result.params).toEqual(["active", 18, "premium", "vip"]);
      });

      it("should handle WHERE groups with JOIN conditions", async () => {
        const req = createRequest("/users", {
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
      const req = createRequest("/users", {
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

    it("should handle bulk INSERT", async () => {
      const req = createRequest("/users", {
        method: "POST",
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
      const req = createRequest("/users/1", {
        method: "PUT",
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
      const req = createRequest("/users", {
        method: "PUT",
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
      const req = createRequest("/users/1", {
        method: "DELETE",
      });

      const result = await adapter.toSQL(req);
      expect(result.sql).toMatch(/DELETE FROM "users"/);
      expect(result.sql).toMatch(/WHERE "id" = \$1/);
      expect(result.params).toEqual(["1"]);
    });

    it("should handle bulk DELETE", async () => {
      const req = createRequest("/users", {
        method: "DELETE",
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
      const url = new URL("http://test.com/users");
      url.searchParams.set("q", "invalid-base64");
      const req = new Request(url);

      await expect(adapter.toSQL(req)).rejects.toThrow(QueryValidationError);
    });

    it("should handle invalid JSON", async () => {
      const url = new URL("http://test.com/users");
      url.searchParams.set(
        "q",
        Buffer.from("{invalid-json}").toString("base64")
      );
      const req = new Request(url);

      await expect(adapter.toSQL(req)).rejects.toThrow(QueryValidationError);
    });

    it("should validate query structure", async () => {
      const req = createRequest("/users", {
        query: {
          select: "invalid-select", // should be an array
        },
      });

      await expect(adapter.toSQL(req)).rejects.toThrow(
        "select must be an array of strings"
      );
    });

    it("should validate where clause structure", async () => {
      const req = createRequest("/users", {
        query: {
          where: {
            field: "status",
            value: "active",
            // missing operator
          },
        },
      });

      await expect(adapter.toSQL(req)).rejects.toThrow(
        "Invalid where clause structure"
      );
    });

    it("should validate join structure", async () => {
      const req = createRequest("/users", {
        query: {
          joins: [
            {
              table: "orders",
              // missing type and on
            },
          ],
        },
      });

      await expect(adapter.toSQL(req)).rejects.toThrow(
        "Invalid joins structure"
      );
    });
  });
});
