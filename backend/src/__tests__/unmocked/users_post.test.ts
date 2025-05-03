import "./unmocked_setup";

import mongoose from "mongoose";
import request from "supertest";
import { Express } from "express";
import { createApp } from "../../app";

describe("POST /users - Unmocked", () => {
  let app: Express;
  let agent: request.Agent;

  beforeAll(async () => {
    jest.setTimeout(60000); // 60 seconds timeout

    // Connect to test database
    try {
      const dbUri = process.env.DB_URI;
      if (!dbUri) {
        throw new Error("Missing environment variable: DB_URI");
      }

      await mongoose.connect(dbUri);
    } catch (error) {
      console.error(`Failed to connect to database: ${String(error)}`);
      throw new Error("Failed to connect to database");
    }
  });

  afterAll(async () => {
    // Clean up database and close connection
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean all collections before each test
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
    // Create app using shared createApp function
    app = createApp();
    agent = request.agent(app);
  });

  /**
   * Test: POST /users
   * Input: Valid user data with email and displayName
   * Expected behavior: Creates a new user
   * Expected output: User object with 201 status code
   */
  test("should create a new user with valid data", async () => {

    // unsupported Http method
    const res = await agent
      .post("/user")
      .send({})
    
    expect(res.status).toBe(404)

    // Use the same email that's set in the auth middleware
    const testEmail = process.env.GOOGLE_TEST_EMAIL ?? "byteswiper@gmail.com";
    const userData = {
      email: testEmail,
      displayName: "Test User"
    };

    const response = await agent
      .post("/users")
      .send(userData)
      .expect("Content-Type", /json/)
      .expect(201);

    expect(response.body).toHaveProperty("email", userData.email);
    expect(response.body).toHaveProperty("displayName", userData.displayName);
    expect(response.body).toHaveProperty("_id");
  });

  /**
   * Test: POST /users
   * Input: Attempt to create user with an email that already exists
   * Expected behavior: Returns 409 status code
   * Expected output: Error message indicating user already exists
   */
  test("should return 409 when creating user with existing email", async () => {
    // Use the same email that's set in the auth middleware
    const testEmail = process.env.GOOGLE_TEST_EMAIL ?? "byteswiper@gmail.com";
    const userData = {
      email: testEmail,
      displayName: "Duplicate User"
    };

    // Create the first user
    await agent
      .post("/users")
      .send(userData)
      .expect("Content-Type", /json/)
      .expect(201);

    // Try to create another user with the same email
    const response = await agent
      .post("/users")
      .send(userData)
      .expect("Content-Type", /json/)
      .expect(409);

    expect(response.body).toEqual({
      error: "User with this email already exists"
    });
  });

  /**
   * Test: POST /users
   * Input: Missing required fields
   * Expected behavior: Returns 400 status code
   * Expected output: Error message indicating missing fields
   */
  test("should return 400 when required fields are missing", async () => {
    const response = await agent
      .post("/users")
      .send({})
      .expect("Content-Type", /json/)
      .expect(400);

    expect(response.body).toHaveProperty("errors");
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          msg: "Valid email is required",
          path: "email"
        }),
        expect.objectContaining({
          msg: "Display name is required",
          path: "displayName"
        })
      ])
    );
  });

  /**
   * Test: POST /users
   * Input: Valid user data when database is disconnected
   * Expected behavior: Returns 500 status code
   * Expected output: Error message indicating internal server error
   */
  test("should return 500 when database error occurs", async () => {
    // First disconnect from database to simulate error
    await mongoose.connection.close();

    // Use the same email that's set in the auth middleware
    const testEmail = process.env.GOOGLE_TEST_EMAIL ?? "byteswiper@gmail.com";
    const userData = {
      email: testEmail,
      displayName: "Error Test User"
    };

    const response = await agent
      .post("/users")
      .send(userData)
      .expect("Content-Type", /json/)
      .expect(500);

    expect(response.body).toEqual({
      error: "Internal Server Error"
    });

    // Reconnect to database for cleanup
    try {
          const dbUri = process.env.DB_URI;
          if (!dbUri) {
            throw new Error("Missing environment variable: DB_URI");
          }
    
          await mongoose.connect(dbUri);
        } catch (error) {
          console.error(`Failed to connect to database: ${String(error)}`);
          throw new Error("Failed to connect to database");
        }
  });
});
