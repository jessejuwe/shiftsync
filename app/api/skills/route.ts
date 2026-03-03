import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const skills = await prisma.skill.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    skills: skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
    })),
  });
}
