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

### Alternative Request Method: JSON Payload

In addition to the standard query string method, RestQL-TS offers an alternative approach for sending requests using JSON payloads via POST requests. This can be particularly useful when dealing with complex queries or when you prefer to organize your request data within a structured JSON format. This method is entirely optional and does not replace the existing query string functionality, which continues to be fully supported.

#### JSON Payload Structure

When using the JSON payload method, the request body should be structured as follows:

```json
{
   "action": "get", // this action is only needed when using the JSON payload method for get requests i.e for select operations
   "query": { // query options and parameters, such as select, where, joins, etc. }
}
```

- **`action`**: This field indicates the desired operation or method that should be performed (this is only used for the query, not the method of the request).
- **`query`**: This field contains the query parameters and options.

### Mutations (POST/PUT/DELETE) (this works with both JSON Payload and Normal Request)

For mutations (POST/PUT/DELETE), the request body should be structured as follows:

```json
[
  { "id": 1, "status": "active" },
  { "id": 2, "status": "inactive" }
]
```

For single update requests, the request body should be structured as follows:

```json
{ "id": 1, "status": "active" }
```

- **`id`**: The id of the record to be updated.
- **`status`**: The new status of the record.

The above is an example of a bulk update request.

For bulk delete requests, the request body should be structured as follows:

```json
[{ "id": 1 }, { "id": 2 }]
```

For single delete requests, the request body should be structured as follows:

```json
{ "id": 1 }
```

For single insert requests, the request body should be structured as follows:

```json
{ "id": 1, "name": "John", "email": "john@example.com" }
```

For bulk insert requests, the request body should be structured as follows:

```json
[
  { "id": 1, "name": "John", "email": "john@example.com" },
  { "id": 2, "name": "Jane", "email": "jane@example.com" }
]
```

### Example using JSON Payload for Mutations

```typescript
import { createWebAdapter } from "restql-ts/adapters/web";

const adapter = createWebAdapter(
  { dialect: "postgres" },
  { enableJsonPayloads: true }
);

const request = new Request("http://api.example.com/users", {
  method: "POST", // the method should always be POST/PUT/DELETE
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify([
    { id: 1, status: "active" },
    { id: 2, status: "inactive" },
  ]),
});
```

### Example using Normal Request for Mutations

```typescript
import { createWebAdapter } from "restql-ts/adapters/web";

const adapter = createWebAdapter({ dialect: "postgres" });

const request = new Request("http://api.example.com/users", {
  method: "POST", // the method should always be POST/PUT/DELETE
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify([
    { id: 1, status: "active" },
    { id: 2, status: "inactive" },
  ]),
});
```

### Recommended Usage

- **`JSON Payload`**: Use this method for complex queries or if you prefer to organize your select query in a human-readable and structured format.
- **`Normal Request`**: Use this method for mutations.

#### Example Usage (JSON Payload) for Select Queries

Here's an example of how to use the JSON payload method for select queries:

```typescript
import { createWebAdapter } from "restql-ts/adapters/web";

const adapter = createWebAdapter(
  { dialect: "postgres" },
  { enableJsonPayloads: true }
);

// Example of a POST request with a JSON payload const request = new
const request = new Request("http://api.example.com/users", {
  method: "POST", // the method should always be POST
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "get",
    query: {
      select: ["id", "name", "email"],
      where: {
        operator: "AND",
        conditions: [
          { field: "age", operator: ">", value: 18 },
          { field: "status", operator: "=", value: "active" },
        ],
      },
    },
  }),
});

const { sql, params } = await adapter.toSQL(request); // SQL: SELECT "id", "name", "email" FROM "users" WHERE "age" > $1 AND "status" = $2 // Params: [18, 'active']
```

In this example:

- A POST request is made to `http://api.example.com/users`.
- The request body is a JSON string.
- The `action` is set to `"get"` to perform a select operation.
- the query has all the other options that are desired.

This approach provides a clean and organized way to handle more complex queries, keeping the URL simple and the request body structured.

#### When to use JSON Payload?

You may prefer to use the JSON payload method in the following scenarios:

- **Complex Queries:** When dealing with deeply nested conditions or a large number of parameters.
- **Improved Readability:** When you want to organize your query in a human-readable and structured format.
- **When you want to use POST** : Some times for security reasons sending information in the URL may not be desired.
- **Security**: When you don't want to have query params in the URL
- **Large paylaods:** the URL can only carry limited amount of data, so to pass large payloads it is desired to use post.

#### Continued Support for Query Strings

Remember, the original query string method, using the `q` parameter, is still fully supported and can be used interchangeably with the JSON payload method.

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

### Fastify Integration

```typescript
import { createFastifyAdapter } from "restql-ts/adapters";

const adapter = createFastifyAdapter({
  dialect: "postgres",
  validation: defaultValidationOptions,
});

fastify.addHook("preHandler", async (request, reply) => {
  try {
    const { sql, params } = await adapter.toSQL(request);
    // Execute query...
  } catch (error) {
    if (error.name === "ValidationError") {
      throw new Error(error.message);
    }
    throw error;
  }
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

## Security Features

The library includes comprehensive SQL injection prevention:

```typescript
import { defaultValidationOptions } from "restql-ts";

const secureRestQL = createRestQL({
  dialect: "postgres",
  validation: {
    ...defaultValidationOptions,
    maxQueryDepth: 3, // Limit query complexity
    maxConditionsPerGroup: 5, // Limit conditions per group
    maxSelectFields: 20, // Limit number of fields
    maxGroupByFields: 5, // Limit GROUP BY fields
    maxValueLength: 1000, // Limit value length
    preventSqlKeywords: true, // Prevent SQL keywords in values
    allowedOperators: ["=", "!=", ">", "<"], // Restrict operators
    allowedLogicalOperators: ["AND", "OR"], // Restrict logical operators
    allowedFieldPattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, // Restrict field names
  },
});
```

### Security Validations

Field Name Protection:
Validates against SQL injection patterns
Prevents SQL keywords in field names
Enforces safe character patterns

Value Protection:
Validates against SQL injection attempts
Prevents dangerous characters
Length limits
SQL keyword prevention

Table Name Protection:
Strict table name pattern validation
Prevents SQL keywords in table names
Length limits on table names

Query Structure Protection:
Depth limits for nested queries
Condition count limits
Field count limits

### Validation Options

```typescript
interface ValidationOptions {
  maxQueryDepth?: number; // Maximum depth of nested conditions
  maxConditionsPerGroup?: number; // Maximum conditions in a WHERE group
  maxSelectFields?: number; // Maximum fields in SELECT
  maxGroupByFields?: number; // Maximum fields in GROUP BY
  allowedOperators?: Operator[]; // Allowed comparison operators
  allowedLogicalOperators?: LogicalOperator[]; // Allowed logical operators
  allowedFieldPattern?: RegExp; // Pattern for valid field names
  maxValueLength?: number; // Maximum length for values
  preventSqlKeywords?: boolean; // Prevent SQL keywords in values
}
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

- [API Reference](docs/api.md) (WIP)
- [Query Examples](docs/examples.md) (WIP)
- [Adapters Guide](docs/adapters.md) (WIP)
- [Contributing Guide](CONTRIBUTING.md)

## License

MIT License - see [LICENSE](LICENSE) for details
