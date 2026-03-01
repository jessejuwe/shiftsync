import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
