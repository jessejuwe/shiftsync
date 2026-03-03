import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/staff/me/skills
 * List the current user's skills. Any authenticated user.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  const staffSkills = await prisma.staffSkill.findMany({
    where: { userId: session.user.id },
    include: { skill: { select: { id: true, name: true } } },
    orderBy: { skill: { name: "asc" } },
  });

  return NextResponse.json({
    skills: staffSkills.map((ss) => ({
      id: ss.id,
      skill: ss.skill,
    })),
  });
}
