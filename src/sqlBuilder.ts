import {
  ParsedRequest,
  RestQLConfig,
  RestQLResponse,
  SQLDialect,
  WhereClause,
  WhereCondition,
  WhereGroup,
} from "./types";

function isWhereCondition(clause: WhereClause): clause is WhereCondition {
  return "field" in clause && "operator" in clause && "value" in clause;
}

export class SQLBuilder {
  private dialect: SQLDialect;
  private schema?: string;

  constructor(config: RestQLConfig) {
    this.dialect = config.dialect;
    this.schema = config.schema;
  }

  private getTableName(table: string): string {
    const escapedTable = this.escapeIdentifier(table);
    return this.schema
      ? `${this.escapeIdentifier(this.schema)}.${escapedTable}`
      : escapedTable;
  }

  private escapeIdentifier(identifier: string): string {
    // Skip escaping if the identifier is already escaped
    if (identifier.startsWith('"') && identifier.endsWith('"')) {
      return identifier;
    }
    if (identifier.startsWith("`") && identifier.endsWith("`")) {
      return identifier;
    }

    // Handle qualified names (e.g., "table.column")
    if (identifier.includes(".")) {
      return identifier
        .split(".")
        .map((part) => this.escapeIdentifier(part))
        .join(".");
    }

    // Handle regular identifiers
    switch (this.dialect) {
      case "mysql":
        return `\`${identifier}\``;
      case "postgres":
      case "sqlite":
        return `"${identifier}"`;
    }
  }

  private buildWhereClause(
    clause: WhereClause,
    paramOffset: number = 0,
    parentOperator?: "AND" | "OR"
  ): { sql: string; values: any[] } {
    if (isWhereCondition(clause)) {
      const paramIndex = paramOffset + 1;
      return {
        sql: `${this.escapeIdentifier(clause.field)} ${clause.operator} ${
          this.dialect === "postgres" ? `$${paramIndex}` : "?"
        }`,
        values: [clause.value],
      };
    }

    let currentOffset = paramOffset;
    const results = clause.conditions.map((c) => {
      const result = this.buildWhereClause(c, currentOffset, clause.operator);
      currentOffset += result.values.length;
      return result;
    });
    const sql = results.map((r) => r.sql).join(` ${clause.operator} `);
    const values = results.flatMap((r) => r.values);

    // Add parentheses when:
    // 1. It's a group with OR operator
    // 2. It's a NOT condition
    // 3. It's an AND group inside an OR
    const needsParentheses =
      clause.operator === "OR" ||
      clause.not ||
      (clause.operator === "AND" && parentOperator === "OR");

    let finalSql = needsParentheses ? `(${sql})` : sql;

    // Add NOT if specified
    if (clause.not) {
      finalSql = `NOT ${finalSql}`;
    }

    return {
      sql: finalSql,
      values,
    };
  }

  private buildInsert(request: ParsedRequest): RestQLResponse {
    const { table, values = [] } = request;
    if (values.length === 0) {
      throw new Error("No values provided for insert");
    }

    const fields = Object.keys(values[0]);
    const tableName = this.getTableName(table);
    const escapedFields = fields.map((f) => this.escapeIdentifier(f));

    // Calculate placeholders with correct parameter numbering
    let paramCounter = 1;
    const placeholders = values
      .map(
        () =>
          `(${fields
            .map(() =>
              this.dialect === "postgres" ? `$${paramCounter++}` : "?"
            )
            .join(", ")})`
      )
      .join(", ");

    const sql = `INSERT INTO ${tableName} (${escapedFields.join(
      ", "
    )}) VALUES ${placeholders}`;
    const params = values.flatMap((v) => fields.map((f) => v[f]));

    return { sql, params };
  }

  private buildSelect(request: ParsedRequest): RestQLResponse {
    const {
      table,
      fields = ["*"],
      where = [],
      joins = [],
      groupBy = [],
      having = [],
      orderBy = [],
      limit,
      offset,
    } = request;
    const tableName = this.getTableName(table);
    const escapedFields = fields.map((f) =>
      f === "*" ? "*" : this.escapeIdentifier(f)
    );

    let sql = `SELECT ${escapedFields.join(", ")} FROM ${tableName}`;
    const params: any[] = [];

    // Build JOINs
    if (joins.length > 0) {
      const joinClauses = joins.map((join) => {
        const joinTable = this.getTableName(join.table);
        const joinTableRef = join.alias || join.table;
        const joinResults = join.on.map((clause) => {
          if (isWhereCondition(clause)) {
            // Handle join conditions where the value is a column reference
            const isColumnRef =
              typeof clause.value === "string" && clause.value.includes(".");
            if (isColumnRef) {
              return {
                sql: `${this.escapeIdentifier(clause.field)} ${
                  clause.operator
                } ${this.escapeIdentifier(clause.value)}`,
                values: [],
              };
            }
          }
          return this.buildWhereClause(clause, params.length);
        });
        const onClause = joinResults.map((r) => r.sql).join(" AND ");
        params.push(...joinResults.flatMap((r) => r.values));

        return `${join.type} JOIN ${joinTable}${
          join.alias ? ` AS ${this.escapeIdentifier(join.alias)}` : ""
        } ON ${onClause}`;
      });

      sql += ` ${joinClauses.join(" ")}`;
    }

    if (where.length > 0) {
      const whereResults = where.map((w) =>
        this.buildWhereClause(w, params.length)
      );
      const whereClause = whereResults.map((r) => r.sql).join(" AND ");
      sql += ` WHERE ${whereClause}`;
      params.push(...whereResults.flatMap((r) => r.values));
    }

    // Add GROUP BY
    if (groupBy.length > 0) {
      const escapedGroups = groupBy.map((g) => this.escapeIdentifier(g));
      sql += ` GROUP BY ${escapedGroups.join(", ")}`;
    }

    // Add HAVING
    if (having.length > 0) {
      const havingResults = having.map((h) =>
        this.buildWhereClause(h, params.length)
      );
      const havingClause = havingResults.map((r) => r.sql).join(" AND ");
      sql += ` HAVING ${havingClause}`;
      params.push(...havingResults.flatMap((r) => r.values));
    }

    // Add ORDER BY
    if (orderBy.length > 0) {
      const orderClauses = orderBy.map(
        (order) => `${this.escapeIdentifier(order.field)} ${order.direction}`
      );
      sql += ` ORDER BY ${orderClauses.join(", ")}`;
    }

    if (limit !== undefined) {
      sql += ` LIMIT ${limit}`;
    }

    if (offset !== undefined) {
      sql += ` OFFSET ${offset}`;
    }

    return { sql, params };
  }

  private buildUpdate(request: ParsedRequest): RestQLResponse {
    const { table, values = [], where = [] } = request;
    if (values.length === 0) {
      throw new Error("No values provided for update");
    }

    const tableName = this.getTableName(table);
    let sql = "";
    let params: any[] = [];

    if (values.length === 1) {
      const updateFields = Object.entries(values[0])
        .filter(([key]) => key !== "id")
        .map(
          ([key], i) =>
            `${this.escapeIdentifier(key)} = ${
              this.dialect === "postgres" ? `$${i + 1}` : "?"
            }`
        );

      sql = `UPDATE ${this.escapeIdentifier(tableName)} SET ${updateFields.join(
        ", "
      )}`;
      params = Object.entries(values[0])
        .filter(([key]) => key !== "id")
        .map(([, value]) => value);

      if (where.length > 0) {
        const whereResults = where.map((w, i) =>
          this.buildWhereClause(w, params.length)
        );
        const whereClause = whereResults.map((r) => r.sql).join(" AND ");
        sql += ` WHERE ${whereClause}`;
        params.push(...whereResults.flatMap((r) => r.values));
      }
    } else {
      // Bulk update using CASE statement
      const updateFields = Object.keys(values[0])
        .filter((key) => key !== "id")
        .map((field) => {
          const cases = values
            .map(
              (v, i) =>
                `WHEN id = ${
                  this.dialect === "postgres" ? `$${i * 2 + 1}` : "?"
                } THEN ${this.dialect === "postgres" ? `$${i * 2 + 2}` : "?"}`
            )
            .join(" ");
          return `${this.escapeIdentifier(
            field
          )} = CASE ${cases} ELSE ${this.escapeIdentifier(field)} END`;
        });

      sql = `UPDATE ${this.escapeIdentifier(tableName)} SET ${updateFields.join(
        ", "
      )} WHERE id IN (${values
        .map((_, i) => (this.dialect === "postgres" ? `$${i + 1}` : "?"))
        .join(", ")})`;
      params = values.flatMap((v) => [
        v.id,
        ...Object.entries(v)
          .filter(([key]) => key !== "id")
          .map(([, value]) => value),
      ]);
    }

    return { sql, params };
  }

  private buildDelete(request: ParsedRequest): RestQLResponse {
    const { table, where = [] } = request;
    const tableName = this.getTableName(table);

    let sql = `DELETE FROM ${tableName}`;
    let params: any[] = [];

    if (where.length > 0) {
      // Check if this is a bulk delete operation by looking at the where clauses
      const isBulkDelete =
        where.length > 1 &&
        where.every(
          (w) => isWhereCondition(w) && w.field === "id" && w.operator === "="
        );

      if (isBulkDelete) {
        // For PostgreSQL, use ANY operator; for MySQL, use IN clause
        const ids = where.map((w) => (w as WhereCondition).value);
        if (this.dialect === "postgres") {
          sql += ` WHERE "id" = ANY($1)`;
          params = [ids];
        } else {
          sql += ` WHERE ${this.escapeIdentifier("id")} IN (${ids
            .map(() => (this.dialect === "postgres" ? "$?" : "?"))
            .join(", ")})`;
          params = ids;
        }
      } else {
        // For single deletes or other conditions
        const whereResults = where.map((w) =>
          this.buildWhereClause(w, params.length)
        );
        const whereClause = whereResults.map((r) => r.sql).join(" AND ");
        sql += ` WHERE ${whereClause}`;
        params.push(...whereResults.flatMap((r) => r.values));
      }
    }

    return { sql, params };
  }

  public build(request: ParsedRequest): RestQLResponse {
    switch (request.operation) {
      case "CREATE":
        return this.buildInsert(request);
      case "READ":
        return this.buildSelect(request);
      case "UPDATE":
        return this.buildUpdate(request);
      case "DELETE":
        return this.buildDelete(request);
      default:
        throw new Error(`Unsupported operation: ${request.operation}`);
    }
  }
}
