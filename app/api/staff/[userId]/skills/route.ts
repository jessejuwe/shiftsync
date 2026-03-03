import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastNotificationCreated } from "@/lib/pusher-events";

/**
 * GET /api/staff/[userId]/skills
 * List skills for a user. Staff can read their own; Admin/Manager can read any.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  const { userId } = await params;
  const role = (session.user as { role?: string }).role;
  const canManageOthers = role === "ADMIN" || role === "MANAGER";

  if (userId !== session.user.id && !canManageOthers) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "You can only view your own skills" },
      { status: 403 }
    );
  }

  const staffSkills = await prisma.staffSkill.findMany({
    where: { userId },
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

/**
 * POST /api/staff/[userId]/skills
 * Add a skill to a user. Admin and Manager only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Admin or manager access required" },
      { status: 403 }
    );
  }

  const { userId } = await params;
  let body: { skillId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { skillId } = body;
  if (!skillId) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "skillId is required" },
      { status: 400 }
    );
  }

  const [user, skill] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.skill.findUnique({ where: { id: skillId } }),
  ]);

  if (!user) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "User not found" },
      { status: 404 }
    );
  }

  if (!skill) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Skill not found" },
      { status: 404 }
    );
  }

  const existing = await prisma.staffSkill.findUnique({
    where: { userId_skillId: { userId, skillId } },
  });

  if (existing) {
    return NextResponse.json(
      { code: "ALREADY_ASSIGNED", message: "User already has this skill" },
      { status: 400 }
    );
  }

  const staffSkill = await prisma.staffSkill.create({
    data: { userId, skillId },
    include: { skill: { select: { id: true, name: true } } },
  });

  await prisma.notification.create({
    data: {
      userId,
      type: "SKILL_ADDED",
      title: "Skill added",
      body: `You have been assigned the skill "${skill.name}".`,
      data: { skillId, skillName: skill.name },
    },
  });

  void broadcastNotificationCreated(userId, {
    notificationType: "SKILL_ADDED",
    title: "Skill added",
  });

  return NextResponse.json({
    staffSkill: {
      id: staffSkill.id,
      skill: staffSkill.skill,
    },
  });
}
