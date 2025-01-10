import { validateAndSanitizeQuery, ValidationError } from "../validation";
import { defaultValidationOptions } from "..";

describe("SQL Injection Prevention", () => {
  const validate = (query: any) =>
    validateAndSanitizeQuery(query, defaultValidationOptions);

  describe("Field Name Validation", () => {
    it("should reject field names with SQL injection attempts", () => {
      const maliciousQueries = [
        { select: ["id; DROP TABLE users;"] },
        { select: ["username '--"] },
        { select: ["password; --"] },
        { select: ["email' OR '1'='1"] },
        { select: ["field FROM users; --"] },
      ];

      maliciousQueries.forEach((query) => {
        expect(() => validate(query)).toThrow(ValidationError);
      });
    });

    // it("should reject field names containing SQL keywords", () => {
    //   const maliciousQueries = [
    //     { select: ["selectFromUsers"] },
    //     { select: ["union_all_data"] },
    //     { select: ["drop_table"] },
    //     { select: ["delete.from.users"] },
    //   ];

    //   maliciousQueries.forEach((query) => {
    //     expect(() => validate(query)).toThrow(ValidationError);
    //   });
    // });
  });

  describe("Value Validation", () => {
    it("should reject values with SQL injection attempts", () => {
      const maliciousQueries = [
        {
          where: { field: "id", operator: "=", value: "1; DROP TABLE users;" },
        },
        {
          where: { field: "name", operator: "=", value: "' OR '1'='1" },
        },
        {
          where: {
            field: "email",
            operator: "=",
            value: "'; DELETE FROM users; --",
          },
        },
        {
          where: {
            field: "password",
            operator: "=",
            value: "' UNION SELECT * FROM passwords; --",
          },
        },
      ];

      maliciousQueries.forEach((query) => {
        expect(() => validate(query)).toThrow(ValidationError);
      });
    });

    it("should reject values containing SQL keywords", () => {
      const maliciousQueries = [
        {
          where: { field: "type", operator: "=", value: "SELECT" },
        },
        {
          where: { field: "status", operator: "=", value: "DROP" },
        },
        {
          where: { field: "role", operator: "=", value: "UNION" },
        },
      ];

      maliciousQueries.forEach((query) => {
        expect(() => validate(query)).toThrow(ValidationError);
      });
    });
  });

  describe("Table Name Validation", () => {
    it("should reject table names with SQL injection attempts", () => {
      const maliciousQueries = [
        {
          joins: [
            {
              type: "LEFT",
              table: "users; DROP TABLE secrets; --",
              on: [{ field: "id", operator: "=", value: "user_id" }],
            },
          ],
        },
        {
          joins: [
            {
              type: "LEFT",
              table: "data' UNION SELECT * FROM passwords; --",
              on: [{ field: "id", operator: "=", value: "data_id" }],
            },
          ],
        },
      ];

      maliciousQueries.forEach((query) => {
        expect(() => validate(query)).toThrow(ValidationError);
      });
    });
  });

  describe("Complex Validation", () => {
    it("should reject nested SQL injection attempts", () => {
      const maliciousQuery = {
        select: ["id", "name"],
        where: {
          operator: "OR",
          conditions: [
            { field: "status", operator: "=", value: "active" },
            {
              operator: "AND",
              conditions: [
                {
                  field: "role",
                  operator: "=",
                  value: "'; DROP TABLE users; --",
                },
                {
                  field: "id'; DELETE FROM users WHERE '1'='1",
                  operator: "=",
                  value: "1",
                },
              ],
            },
          ],
        },
        joins: [
          {
            type: "LEFT",
            table: "profiles",
            alias: "p'; DROP TABLE profiles; --",
            on: [
              {
                field: "user_id",
                operator: "=",
                value: "'; DELETE FROM users; --",
              },
            ],
          },
        ],
      };

      expect(() => validate(maliciousQuery)).toThrow(ValidationError);
    });
  });

  describe("Valid Queries", () => {
    it("should allow valid queries", () => {
      const validQuery = {
        select: ["id", "name", "email"],
        where: {
          operator: "AND",
          conditions: [
            { field: "status", operator: "=", value: "active" },
            { field: "age", operator: ">", value: 18 },
          ],
        },
        joins: [
          {
            type: "LEFT",
            table: "profiles",
            alias: "p",
            on: [{ field: "user_id", operator: "=", value: "id" }],
          },
        ],
        orderBy: [{ field: "created_at", direction: "DESC" }],
        limit: 10,
      };

      expect(() => validate(validQuery)).not.toThrow();
    });
  });

  describe("Value Length Validation", () => {
    it("should reject values exceeding maximum length", () => {
      const longValue = "a".repeat(1001); // Default maxValueLength is 1000
      const query = {
        where: { field: "description", operator: "=", value: longValue },
      };

      expect(() => validate(query)).toThrow(ValidationError);
    });
  });
});
