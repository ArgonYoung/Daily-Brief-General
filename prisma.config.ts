import "dotenv/config";
import { defineConfig } from "prisma/config";

// Use DIRECT_URL for migrations/pushes if specified, falling back to DATABASE_URL
const dbUrl = process.env.DATABASE_URL || "file:./dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
  datasource: {
    url: dbUrl,
  },
});
