import { createWebAdapter } from "../src/adapters/web";
import { Pool } from "pg"; // Using PostgreSQL as an example

// Database connection
const pool = new Pool({
  user: "postgres",
  password: "password",
  host: "localhost",
  database: "mydb",
  port: 5432,
});

// Create RestQL adapter
const adapter = createWebAdapter({
  dialect: "postgres",
  schema: "public",
});

// Middleware for automatic CRUD operations
export async function restqlMiddleware(req: Request): Promise<Response> {
  try {
    // Convert request to SQL
    const { sql, params } = await adapter.toSQL(req);

    // Execute query
    const result = await pool.query(sql, params);

    // Format response based on operation
    const method = req.method;
    let response: any = {};

    switch (method) {
      case "GET":
        response = result.rows;
        break;
      case "POST":
        response = {
          message: "Created successfully",
          data: result.rows[0],
        };
        break;
      case "PUT":
        response = {
          message: "Updated successfully",
          affected: result.rowCount,
        };
        break;
      case "DELETE":
        response = {
          message: "Deleted successfully",
          affected: result.rowCount,
        };
        break;
    }

    return new Response(JSON.stringify(response), {
      status: method === "POST" ? 201 : 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("RestQL Error:", error);

    return new Response(
      JSON.stringify({
        error: error.message,
        code: error.code, // SQL error code if available
      }),
      {
        status: error.code === "23505" ? 409 : 400, // 409 for unique violation
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Example with transaction support
export async function restqlTransactionMiddleware(
  req: Request
): Promise<Response> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { sql, params } = await adapter.toSQL(req);
    const result = await client.query(sql, params);

    await client.query("COMMIT");

    return new Response(JSON.stringify(result.rows), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    client.release();
  }
}

// Example with caching
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

export async function restqlCachedMiddleware(req: Request): Promise<Response> {
  // Only cache GET requests
  if (req.method === "GET") {
    const cacheKey = req.url;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify(cached.data), {
        headers: {
          "Content-Type": "application/json",
          "X-Cache": "HIT",
        },
      });
    }

    const { sql, params } = await adapter.toSQL(req);
    const result = await pool.query(sql, params);

    cache.set(cacheKey, {
      data: result.rows,
      timestamp: Date.now(),
    });

    return new Response(JSON.stringify(result.rows), {
      headers: {
        "Content-Type": "application/json",
        "X-Cache": "MISS",
      },
    });
  }

  // Non-GET requests bypass cache
  return restqlMiddleware(req);
}
