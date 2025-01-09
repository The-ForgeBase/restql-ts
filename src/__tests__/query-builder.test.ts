import { QueryBuilder } from "../sdk/query-builder";

describe("QueryBuilder", () => {
  function decodeQuery(encoded: string): any {
    return JSON.parse(Buffer.from(encoded, "base64").toString());
  }

  it("should build simple SELECT query", () => {
    const query = new QueryBuilder()
      .selectFields(["id", "name", "email"])
      .build();

    const decoded = decodeQuery(query);
    expect(decoded).toEqual({
      select: ["id", "name", "email"],
    });
  });

  it("should build query with WHERE conditions", () => {
    const query = new QueryBuilder()
      .selectFields(["*"])
      .where("age", ">", 18)
      .where("status", "=", "active")
      .build();

    const decoded = decodeQuery(query);
    expect(decoded).toEqual({
      select: ["*"],
      where: {
        operator: "AND",
        conditions: [
          { field: "age", operator: ">", value: 18 },
          { field: "status", operator: "=", value: "active" },
        ],
      },
    });
  });

  it("should build query with WHERE group", () => {
    const query = new QueryBuilder()
      .whereGroup("OR", [
        { field: "status", operator: "=", value: "active" },
        { field: "status", operator: "=", value: "pending" },
      ])
      .build();

    const decoded = decodeQuery(query);
    expect(decoded).toEqual({
      select: ["*"],
      where: {
        operator: "OR",
        conditions: [
          { field: "status", operator: "=", value: "active" },
          { field: "status", operator: "=", value: "pending" },
        ],
      },
    });
  });

  it("should build query with JOIN", () => {
    const query = new QueryBuilder()
      .selectFields(["users.id", "orders.total"])
      .join("LEFT", "orders", "users.id", "=", "orders.user_id")
      .build();

    const decoded = decodeQuery(query);
    expect(decoded).toEqual({
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
    });
  });

  it("should build query with GROUP BY and HAVING", () => {
    const query = new QueryBuilder()
      .selectFields(["user_id", "COUNT(*) as order_count"])
      .groupBy(["user_id"])
      .having("COUNT(*)", ">", 5)
      .build();

    const decoded = decodeQuery(query);
    expect(decoded).toEqual({
      select: ["user_id", "COUNT(*) as order_count"],
      groupBy: ["user_id"],
      having: [{ field: "COUNT(*)", operator: ">", value: 5 }],
    });
  });

  it("should build query with ORDER BY and pagination", () => {
    const query = new QueryBuilder()
      .orderBy("created_at", "DESC")
      .limit(10)
      .offset(20)
      .build();

    const decoded = decodeQuery(query);
    expect(decoded).toEqual({
      select: ["*"],
      orderBy: [{ field: "created_at", direction: "DESC" }],
      limit: 10,
      offset: 20,
    });
  });

  it("should build complex query", () => {
    const query = new QueryBuilder()
      .selectFields(["users.id", "orders.total"])
      .join("LEFT", "orders", "users.id", "=", "orders.user_id")
      .where("orders.total", ">", 100)
      .groupBy(["users.id"])
      .having("COUNT(*)", ">", 1)
      .orderBy("orders.total", "DESC")
      .limit(10)
      .build();

    const decoded = decodeQuery(query);
    expect(decoded).toEqual({
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
        field: "orders.total",
        operator: ">",
        value: 100,
      },
      groupBy: ["users.id"],
      having: [{ field: "COUNT(*)", operator: ">", value: 1 }],
      orderBy: [{ field: "orders.total", direction: "DESC" }],
      limit: 10,
    });
  });

  it("should build query with complex JOIN conditions", () => {
    const query = new QueryBuilder()
      .selectFields(["u.id", "o.total", "o.status"])
      .startJoin("LEFT", "orders", "o")
      .onEquals("u.id", "o.user_id")
      .on("o.status", "=", "active")
      .endJoin()
      .build();

    const decoded = decodeQuery(query);
    expect(decoded).toEqual({
      select: ["u.id", "o.total", "o.status"],
      joins: [
        {
          type: "LEFT",
          table: "orders",
          alias: "o",
          on: [
            {
              field: "u.id",
              operator: "=",
              value: "o.user_id",
            },
            {
              field: "o.status",
              operator: "=",
              value: "active",
            },
          ],
        },
      ],
    });
  });

  it("should build query with multiple JOINs", () => {
    const query = new QueryBuilder()
      .selectFields(["u.id", "o.total", "p.name"])
      .startJoin("LEFT", "orders", "o")
      .onEquals("u.id", "o.user_id")
      .endJoin()
      .startJoin("INNER", "products", "p")
      .onEquals("o.product_id", "p.id")
      .on("p.active", "=", true)
      .endJoin()
      .build();

    const decoded = decodeQuery(query);
    expect(decoded).toEqual({
      select: ["u.id", "o.total", "p.name"],
      joins: [
        {
          type: "LEFT",
          table: "orders",
          alias: "o",
          on: [
            {
              field: "u.id",
              operator: "=",
              value: "o.user_id",
            },
          ],
        },
        {
          type: "INNER",
          table: "products",
          alias: "p",
          on: [
            {
              field: "o.product_id",
              operator: "=",
              value: "p.id",
            },
            {
              field: "p.active",
              operator: "=",
              value: true,
            },
          ],
        },
      ],
    });
  });

  it("should throw error when adding join condition without starting join", () => {
    const query = new QueryBuilder();
    expect(() => {
      query.on("field", "=", "value");
    }).toThrow("Must call startJoin before adding join conditions");
  });

  it("should throw error when ending join without conditions", () => {
    const query = new QueryBuilder();
    query.startJoin("LEFT", "orders", "o");
    expect(() => {
      query.endJoin();
    }).toThrow("Join must have at least one ON condition");
  });

  describe("WHERE groups", () => {
    it("should build query with simple WHERE group", () => {
      const query = new QueryBuilder()
        .whereGroup("AND", [
          { field: "age", operator: ">", value: 18 },
          { field: "status", operator: "=", value: "active" },
        ])
        .build();

      const decoded = decodeQuery(query);
      expect(decoded).toEqual({
        select: ["*"],
        where: {
          operator: "AND",
          conditions: [
            { field: "age", operator: ">", value: 18 },
            { field: "status", operator: "=", value: "active" },
          ],
        },
      });
    });

    it("should build query with nested WHERE groups", () => {
      const query = new QueryBuilder()
        .whereGroup("OR", [
          { field: "status", operator: "=", value: "active" },
          {
            operator: "AND",
            conditions: [
              { field: "age", operator: ">", value: 18 },
              { field: "type", operator: "=", value: "premium" },
            ],
          },
        ])
        .build();

      const decoded = decodeQuery(query);
      expect(decoded).toEqual({
        select: ["*"],
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
      });
    });

    it("should build query with NOT WHERE group", () => {
      const query = new QueryBuilder()
        .notWhereGroup("AND", [
          { field: "status", operator: "=", value: "deleted" },
          { field: "type", operator: "=", value: "temporary" },
        ])
        .build();

      const decoded = decodeQuery(query);
      expect(decoded).toEqual({
        select: ["*"],
        where: {
          operator: "AND",
          conditions: [
            { field: "status", operator: "=", value: "deleted" },
            { field: "type", operator: "=", value: "temporary" },
          ],
          not: true,
        },
      });
    });

    it("should build query with fluent WHERE group API", () => {
      const query = new QueryBuilder()
        .beginWhereGroup("AND")
        .where("status", "=", "active")
        .where("age", ">", 18)
        .endWhereGroup()
        .build();

      const decoded = decodeQuery(query);
      expect(decoded).toEqual({
        select: ["*"],
        where: {
          operator: "AND",
          conditions: [
            { field: "status", operator: "=", value: "active" },
            { field: "age", operator: ">", value: 18 },
          ],
        },
      });
    });

    it("should build query with NOT fluent WHERE group", () => {
      const query = new QueryBuilder()
        .beginWhereGroup("AND", true)
        .where("status", "=", "deleted")
        .where("type", "=", "temporary")
        .endWhereGroup()
        .build();

      const decoded = decodeQuery(query);
      expect(decoded).toEqual({
        select: ["*"],
        where: {
          operator: "AND",
          conditions: [
            { field: "status", operator: "=", value: "deleted" },
            { field: "type", operator: "=", value: "temporary" },
          ],
          not: true,
        },
      });
    });

    it("should throw error when starting nested WHERE group without ending previous one", () => {
      const query = new QueryBuilder().beginWhereGroup("AND");
      expect(() => {
        query.beginWhereGroup("OR");
      }).toThrow("Cannot start a new WHERE group while another one is active");
    });

    it("should throw error when ending WHERE group without starting one", () => {
      const query = new QueryBuilder();
      expect(() => {
        query.endWhereGroup();
      }).toThrow("No active WHERE group to end");
    });

    it("should throw error when ending empty WHERE group", () => {
      const query = new QueryBuilder().beginWhereGroup("AND");
      expect(() => {
        query.endWhereGroup();
      }).toThrow("WHERE group must have at least one condition");
    });
  });
});
