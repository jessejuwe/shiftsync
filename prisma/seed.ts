import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Example seed - extend as needed
  const admin = await prisma.user.upsert({
    where: { email: "admin@shiftsync.local" },
    update: {},
    create: {
      email: "admin@shiftsync.local",
      name: "Admin User",
      role: "ADMIN",
      passwordHash: "placeholder", // Replace with real hash
    },
  });

  console.log("Seeded:", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
