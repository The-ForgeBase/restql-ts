import {
  JoinType,
  Operator,
  OrderByClause,
  WhereCondition,
  WhereGroup,
  WhereClause,
  JoinCondition,
} from "../types";

export class QueryBuilder {
  private select: string[] = ["*"];
  private whereConditions: WhereClause[] = [];
  private joins: JoinCondition[] = [];
  private groupByFields: string[] = [];
  private havingConditions: WhereCondition[] = [];
  private orderByClauses: OrderByClause[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private currentJoinIndex: number = -1;

  constructor() {}

  /**
   * Select specific fields
   * @example
   * query.selectFields(["id", "name", "email"])
   */
  selectFields(fields: string[]): this {
    this.select = fields;
    return this;
  }

  /**
   * Add a WHERE condition
   * @example
   * query.where("age", ">", 18)
   */
  where(field: string, operator: Operator, value: any): this {
    const condition: WhereCondition = { field, operator, value };
    if (this.currentWhereGroup) {
      this.currentWhereGroup.conditions.push(condition);
    } else {
      this.whereConditions.push(condition);
    }
    return this;
  }

  /**
   * Add a WHERE group with AND/OR conditions
   * @example
   * // Simple group
   * query.whereGroup("AND", [
   *   { field: "age", operator: ">", value: 18 },
   *   { field: "status", operator: "=", value: "active" }
   * ])
   *
   * // Nested group
   * query.whereGroup("OR", [
   *   { field: "status", operator: "=", value: "active" },
   *   {
   *     operator: "AND",
   *     conditions: [
   *       { field: "age", operator: ">", value: 18 },
   *       { field: "type", operator: "=", value: "premium" }
   *     ]
   *   }
   * ])
   */
  whereGroup(
    operator: "AND" | "OR",
    conditions: (WhereCondition | WhereGroup)[],
    not?: boolean
  ): this {
    this.whereConditions.push({
      operator,
      conditions,
      not,
    });
    return this;
  }

  /**
   * Add a NOT WHERE group
   * @example
   * query.notWhereGroup("AND", [
   *   { field: "status", operator: "=", value: "deleted" },
   *   { field: "type", operator: "=", value: "temporary" }
   * ])
   */
  notWhereGroup(
    operator: "AND" | "OR",
    conditions: (WhereCondition | WhereGroup)[]
  ): this {
    return this.whereGroup(operator, conditions, true);
  }

  /**
   * Start building a WHERE group with fluent API
   * @example
   * query.beginWhereGroup("AND")
   *   .where("status", "=", "active")
   *   .where("age", ">", 18)
   *   .endWhereGroup()
   */
  private currentWhereGroup?: {
    operator: "AND" | "OR";
    conditions: (WhereCondition | WhereGroup)[];
    not?: boolean;
  };

  beginWhereGroup(operator: "AND" | "OR", not?: boolean): this {
    if (this.currentWhereGroup) {
      throw new Error(
        "Cannot start a new WHERE group while another one is active"
      );
    }
    this.currentWhereGroup = {
      operator,
      conditions: [],
      not,
    };
    return this;
  }

  /**
   * End the current WHERE group
   */
  endWhereGroup(): this {
    if (!this.currentWhereGroup) {
      throw new Error("No active WHERE group to end");
    }
    if (this.currentWhereGroup.conditions.length === 0) {
      throw new Error("WHERE group must have at least one condition");
    }
    this.whereConditions.push(this.currentWhereGroup);
    this.currentWhereGroup = undefined;
    return this;
  }

  /**
   * Start a new JOIN clause
   * @example
   * query.startJoin("LEFT", "orders", "o")
   */
  startJoin(type: JoinType, table: string, alias?: string): this {
    this.joins.push({
      type,
      table,
      alias,
      on: [],
    });
    this.currentJoinIndex = this.joins.length - 1;
    return this;
  }

  /**
   * Add a JOIN condition to the current join
   * @example
   * query.startJoin("LEFT", "orders", "o")
   *   .onEquals("users.id", "o.user_id")
   *   .on("o.status", "=", "active")
   */
  on(field: string, operator: Operator, value: any): this {
    if (this.currentJoinIndex === -1) {
      throw new Error("Must call startJoin before adding join conditions");
    }
    this.joins[this.currentJoinIndex].on.push({
      field,
      operator,
      value,
    });
    return this;
  }

  /**
   * Add an equals JOIN condition (shorthand for most common case)
   * @example
   * query.startJoin("LEFT", "orders", "o")
   *   .onEquals("users.id", "o.user_id")
   */
  onEquals(leftField: string, rightField: string): this {
    return this.on(leftField, "=", rightField);
  }

  /**
   * End the current JOIN clause
   */
  endJoin(): this {
    if (this.currentJoinIndex === -1) {
      throw new Error("No active join to end");
    }
    if (this.joins[this.currentJoinIndex].on.length === 0) {
      throw new Error("Join must have at least one ON condition");
    }
    this.currentJoinIndex = -1;
    return this;
  }

  /**
   * Simple join with a single equals condition (for backwards compatibility)
   * @example
   * query.join("LEFT", "orders", "users.id", "=", "orders.user_id")
   */
  join(
    type: JoinType,
    table: string,
    leftField: string,
    operator: Operator,
    rightField: string
  ): this {
    return this.startJoin(type, table)
      .on(leftField, operator, rightField)
      .endJoin();
  }

  /**
   * Add GROUP BY fields
   * @example
   * query.groupBy(["department", "status"])
   */
  groupBy(fields: string[]): this {
    this.groupByFields = fields;
    return this;
  }

  /**
   * Add a HAVING condition
   * @example
   * query.having("COUNT(*)", ">", 5)
   */
  having(field: string, operator: Operator, value: any): this {
    this.havingConditions.push({ field, operator, value });
    return this;
  }

  /**
   * Add ORDER BY clause
   * @example
   * query.orderBy("created_at", "DESC")
   */
  orderBy(field: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.orderByClauses.push({ field, direction });
    return this;
  }

  /**
   * Set LIMIT value
   * @example
   * query.limit(10)
   */
  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  /**
   * Set OFFSET value
   * @example
   * query.offset(20)
   */
  offset(value: number): this {
    this.offsetValue = value;
    return this;
  }

  /**
   * Build and encode the query
   * @returns Base64 encoded query string
   */
  build(): string {
    const query: Record<string, any> = {};

    if (this.select.length > 0) {
      query.select = this.select;
    }

    if (this.whereConditions.length > 0) {
      if (this.whereConditions.length === 1) {
        query.where = this.whereConditions[0];
      } else {
        query.where = {
          operator: "AND",
          conditions: this.whereConditions,
        };
      }
    }

    if (this.joins.length > 0) {
      query.joins = this.joins;
    }

    if (this.groupByFields.length > 0) {
      query.groupBy = this.groupByFields;
    }

    if (this.havingConditions.length > 0) {
      query.having = this.havingConditions;
    }

    if (this.orderByClauses.length > 0) {
      query.orderBy = this.orderByClauses;
    }

    if (this.limitValue !== undefined) {
      query.limit = this.limitValue;
    }

    if (this.offsetValue !== undefined) {
      query.offset = this.offsetValue;
    }

    return Buffer.from(JSON.stringify(query)).toString("base64");
  }
}
