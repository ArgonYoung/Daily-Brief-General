import { Pool } from "pg";

async function testConfig(name: string, config: any) {
  console.log(`\n--- Testing ${name} ---`);
  const pool = new Pool(config);
  try {
    const client = await pool.connect();
    const res = await client.query("SELECT 1 as result");
    console.log(`SUCCESS! result:`, res.rows);
    client.release();
  } catch (err: any) {
    console.error(`FAILED:`, err.message || err);
  } finally {
    await pool.end();
  }
}

async function main() {
  // Test 1: Direct Host on port 5432 WITH SSL
  await testConfig("Direct Connection - WITH SSL (Host: db..., User: postgres, Port: 5432)", {
    user: "postgres",
    password: "ArgonDatabase123",
    host: "db.caumjqvpvohukszrrvjh.supabase.co",
    port: 5432,
    database: "postgres",
    ssl: { rejectUnauthorized: false }
  });

  // Test 2: Pooler Host on port 6543 WITH SSL
  await testConfig("Pooler Connection - WITH SSL (Host: pooler..., User: postgres.project-ref, Port: 6543)", {
    user: "postgres.caumjqvpvohukszrrvjh",
    password: "ArgonDatabase123",
    host: "aws-1-ap-northeast-2.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    ssl: { rejectUnauthorized: false }
  });
}

main();
