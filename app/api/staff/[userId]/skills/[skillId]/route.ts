import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastNotificationCreated } from "@/lib/pusher-events";

/**
 * DELETE /api/staff/[userId]/skills/[skillId]
 * Remove a skill from a user. Admin and Manager only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string; skillId: string }> }
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

  const { userId, skillId } = await params;

  const existing = await prisma.staffSkill.findUnique({
    where: { userId_skillId: { userId, skillId } },
    include: { skill: { select: { id: true, name: true } } },
  });

  const deleted = await prisma.staffSkill.deleteMany({
    where: { userId, skillId },
  });

  if (deleted.count === 0) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Skill assignment not found" },
      { status: 404 }
    );
  }

  if (existing?.skill) {
    await prisma.notification.create({
      data: {
        userId,
        type: "SKILL_REMOVED",
        title: "Skill removed",
        body: `The skill "${existing.skill.name}" has been removed from your profile.`,
        data: { skillId, skillName: existing.skill.name },
      },
    });
    void broadcastNotificationCreated(userId, {
      notificationType: "SKILL_REMOVED",
      title: "Skill removed",
    });
  }

  return NextResponse.json({ success: true });
}
