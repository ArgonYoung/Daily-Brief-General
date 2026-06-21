import { prisma } from "../src/lib/prisma";
import "dotenv/config";

async function main() {
  console.log("Checking database contents...");
  const users = await prisma.user.findMany();
  const modules = await prisma.module.findMany();
  const briefs = await prisma.briefSchedule.findMany({
    include: {
      mappings: {
        include: { module: true }
      }
    }
  });

  console.log("--- USERS ---");
  console.log(users);
  
  console.log("--- MODULES ---");
  console.log(modules.map(m => ({ id: m.id, name: m.name })));
  
  console.log("--- BRIEFS ---");
  console.log(briefs);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
