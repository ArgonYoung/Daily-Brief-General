import { Pool } from "pg";
import "dotenv/config";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const ddl = `
-- Create User table
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT UNIQUE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Module table
CREATE TABLE IF NOT EXISTS "Module" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "configSchema" JSONB NOT NULL,
    "isOfficial" BOOLEAN DEFAULT FALSE,
    "authorId" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create UserModuleConfig table
CREATE TABLE IF NOT EXISTS "UserModuleConfig" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "moduleId" TEXT NOT NULL REFERENCES "Module"("id") ON DELETE CASCADE,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create BriefSchedule table
CREATE TABLE IF NOT EXISTS "BriefSchedule" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "notionPageId" TEXT NOT NULL,
    "notionTokenEncrypted" TEXT NOT NULL,
    "isEnabled" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create BriefModuleMapping table
CREATE TABLE IF NOT EXISTS "BriefModuleMapping" (
    "id" TEXT PRIMARY KEY,
    "briefScheduleId" TEXT NOT NULL REFERENCES "BriefSchedule"("id") ON DELETE CASCADE,
    "userModuleConfigId" TEXT NOT NULL REFERENCES "UserModuleConfig"("id") ON DELETE CASCADE,
    "moduleId" TEXT NOT NULL REFERENCES "Module"("id") ON DELETE CASCADE,
    "sortOrder" INTEGER NOT NULL
);

-- Create BriefLog table
CREATE TABLE IF NOT EXISTS "BriefLog" (
    "id" TEXT PRIMARY KEY,
    "briefScheduleId" TEXT NOT NULL REFERENCES "BriefSchedule"("id") ON DELETE CASCADE,
    "triggeredAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT
);
`;

async function main() {
  console.log("Connecting to database and creating tables...");
  const client = await pool.connect();
  try {
    await client.query(ddl);
    console.log("All tables created successfully!");
  } catch (err) {
    console.error("DDL execution failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
