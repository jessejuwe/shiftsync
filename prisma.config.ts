import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Use DIRECT_URL for migrations when using a connection pooler (Neon, Supabase, etc.)
    url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
  },
});
