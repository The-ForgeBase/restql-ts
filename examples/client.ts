import { WhereClause, OrderByClause } from "../src/types";

interface FindUsersOptions {
  fields?: string[];
  where?: WhereClause;
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
}

// Helper function to encode query
function encodeQuery(query: any): string {
  return btoa(JSON.stringify(query));
}

// Example API client
class RestQLClient {
  constructor(private baseUrl: string) {}

  private async request(path: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Request failed");
    }

    return response.json();
  }

  // Example methods
  async findUsers({
    fields = ["*"],
    where,
    orderBy = [],
    limit,
    offset,
  }: FindUsersOptions = {}) {
    const query = encodeQuery({
      select: fields,
      where,
      orderBy,
      limit,
      offset,
    });

    return this.request(`/users?q=${query}`);
  }

  async findUserWithOrders(userId: number) {
    const query = encodeQuery({
      select: [
        "users.id",
        "users.name",
        "users.email",
        "orders.id as order_id",
        "orders.total",
      ],
      joins: [
        {
          type: "LEFT",
          table: "orders",
          on: [{ field: "users.id", operator: "=", value: "orders.user_id" }],
        },
      ],
      where: {
        operator: "AND",
        conditions: [{ field: "users.id", operator: "=", value: userId }],
      },
    });

    return this.request(`/users?q=${query}`);
  }

  async createUser(userData: any) {
    return this.request("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: number, updates: any) {
    return this.request(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async deleteUser(userId: number) {
    return this.request(`/users/${userId}`, {
      method: "DELETE",
    });
  }

  // Complex query example
  async findActiveUsersInCity(city: string, minOrderTotal: number) {
    const query = encodeQuery({
      select: [
        "users.id",
        "users.name",
        "users.email",
        "COUNT(orders.id) as order_count",
        "SUM(orders.total) as total_spent",
      ],
      joins: [
        {
          type: "LEFT",
          table: "orders",
          on: [{ field: "users.id", operator: "=", value: "orders.user_id" }],
        },
      ],
      where: {
        operator: "AND",
        conditions: [
          { field: "users.city", operator: "=", value: city },
          { field: "users.status", operator: "=", value: "active" },
          {
            operator: "OR",
            conditions: [
              { field: "orders.total", operator: ">", value: minOrderTotal },
              { field: "users.vip", operator: "=", value: true },
            ],
          },
        ],
      },
      groupBy: ["users.id", "users.name", "users.email"],
      having: [{ field: "COUNT(orders.id)", operator: ">=", value: 3 }],
      orderBy: [{ field: "total_spent", direction: "DESC" }],
      limit: 10,
    });

    return this.request(`/users?q=${query}`);
  }
}

// Usage examples
async function examples() {
  const client = new RestQLClient("http://api.example.com");

  try {
    // Simple queries
    const allUsers = await client.findUsers();

    const activeUsers = await client.findUsers({
      where: { field: "status", operator: "=", value: "active" },
    });

    const paginatedUsers = await client.findUsers({
      limit: 10,
      offset: 0,
      orderBy: [{ field: "createdAt", direction: "DESC" }],
    });

    // Complex query
    const vipUsers = await client.findActiveUsersInCity("New York", 1000);

    // Mutations
    const newUser = await client.createUser({
      name: "John Doe",
      email: "john@example.com",
      city: "New York",
    });

    await client.updateUser(newUser.id, {
      status: "active",
    });

    // Relations
    const userWithOrders = await client.findUserWithOrders(newUser.id);

    console.log({
      allUsers,
      activeUsers,
      paginatedUsers,
      vipUsers,
      newUser,
      userWithOrders,
    });
  } catch (error) {
    console.error("API Error:", error);
  }
}

// Run examples
examples();
