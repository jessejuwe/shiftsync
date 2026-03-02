import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const deleted = await prisma.staffSkill.deleteMany({
    where: { userId, skillId },
  });

  if (deleted.count === 0) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Skill assignment not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
