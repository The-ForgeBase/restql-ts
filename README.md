# RestQL-TS

RestQL-TS is a powerful TypeScript library that converts REST API requests into SQL queries. It provides a flexible and type-safe way to transform HTTP requests into database operations, supporting multiple SQL dialects including MySQL, PostgreSQL, and SQLite.

## Features

- 🚀 **REST to SQL Translation**: Automatically converts REST API requests into optimized SQL queries
- 🎯 **Type Safety**: Full TypeScript support with comprehensive type definitions
- 🔌 **Multiple SQL Dialects**: Supports MySQL, PostgreSQL, and SQLite
- 🔄 **Flexible Query Building**: Advanced query capabilities including:
  - Complex WHERE conditions with AND/OR grouping
  - Nested conditions and NOT operators
  - JOINs with multiple conditions and aliases
  - GROUP BY, HAVING, ORDER BY, and pagination
- 🌐 **Framework Agnostic**: Works with any web framework through adapters
  - Express adapter
  - Fastify adapter
  - Web standard adapter
- 🛡️ **Query Validation for adapters**: Built-in validation and sanitization for adapters
- 🛡️ **Query Sanitization**: Built-in sanitization which includes custom sanitization and validation options (WIP)
- 🔍 **Parameter Binding**: Secure parameter binding to prevent SQL injection

## Installation

```bash
npm install restql-ts
# or
yarn add restql-ts
# or
pnpm add restql-ts
```

## Quick Start

### Important Note

The `encodeQuery` and `decodeQuery` functions are used to encode and decode the query string. They are not part of the RestQL library, but they are provided for convenience.

### Basic Usage

```typescript
import { createWebAdapter } from "restql-ts/adapters/web";
import { encodeQuery, decodeQuery } from "restql-ts";

// Create an adapter with your preferred SQL dialect
const adapter = createWebAdapter({
  dialect: "postgres", // or 'mysql' or 'sqlite'
});

// Convert a REST request to SQL
// The query string should be in the format of `q=encodedQuery`
// The encoded query should be a valid JSON string
// You can use the `encodeQuery` function to encode the query string
// This is an example of a GET request
const request = new Request(
  "http://api.example.com/users?q=" +
    encodeQuery(
      JSON.stringify({
        select: ["id", "name", "email"],
        where: {
          operator: "AND",
          conditions: [
            { field: "age", operator: ">", value: 18 },
            { field: "status", operator: "=", value: "active" },
          ],
        },
      })
    )
);

const { sql, params } = await adapter.toSQL(request);
// SQL: SELECT "id", "name", "email" FROM "users" WHERE "age" > $1 AND "status" = $2
// Params: [18, 'active']
```

### Express Integration

```typescript
import express from "express";
import { createExpressAdapter } from "restql-ts/adapters/express";

const app = express();
const adapter = createExpressAdapter({
  dialect: "mysql",
});

app.get("/users", async (req, res) => {
  // The query string should have being encoded from the client side
  // The query string should be in the format of `q=encodedQuery`
  // The encoded query should be a valid JSON string
  // You can use the `encodeQuery` function to encode the query string
  const { sql, params } = await adapter.toSQL(req);
  // Execute the query with your database client
  // const result = await db.query(sql, params);
  res.json(result);
});
```

### Complex Queries

```typescript
// Complex query with joins and nested conditions
const query = {
  select: ["users.id", "orders.total"],
  joins: [
    {
      type: "LEFT",
      table: "orders",
      alias: "o",
      on: [{ field: "users.id", operator: "=", value: "o.user_id" }],
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
  orderBy: [{ field: "orders.total", direction: "DESC" }],
  limit: 10,
  offset: 0,
};
```

## Query Structure

### Select Query

```typescript
interface QueryOptions {
  select?: string[];
  where?: WhereClause[];
  joins?: JoinCondition[];
  orderBy?: OrderByClause[];
  groupBy?: string[];
  having?: WhereClause[];
  limit?: number;
  offset?: number;
}
```

### Where Conditions

```typescript
interface WhereCondition {
  field: string;
  operator: Operator;
  value: any;
}

interface WhereGroup {
  operator: "AND" | "OR";
  conditions: (WhereCondition | WhereGroup)[];
  not?: boolean;
}
```

### Join Conditions

```typescript
interface JoinCondition {
  type: "INNER" | "LEFT" | "RIGHT" | "FULL";
  table: string;
  alias?: string;
  on: WhereClause[];
}
```

## Supported Operations

- **SELECT**: Query data with complex conditions
- **INSERT**: Single and bulk inserts
- **UPDATE**: Single and bulk updates
- **DELETE**: Single and bulk deletes

## Error Handling

The library provides built-in error handling and validation:

```typescript
try {
  const { sql, params } = await adapter.toSQL(request);
} catch (error) {
  if (error instanceof QueryValidationError) {
    // Handle validation errors
  }
  // Handle other errors
}
```

## Documentation

For more detailed documentation, please visit:

- [API Reference](docs/api.md)
- [Query Examples](docs/examples.md)
- [Adapters Guide](docs/adapters.md)
- [Contributing Guide](CONTRIBUTING.md)

## License

MIT License - see [LICENSE](LICENSE) for details
