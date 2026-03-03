import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/shifts/[id]/qualified-staff
 * Returns all staff certified at the location. No filtering by skills, availability, or conflicts.
 * Admin/manager sees certified staff; assign API enforces constraints and returns clear errors.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Manager or admin access required" },
      { status: 403 }
    );
  }

  const { id: shiftId } = await params;

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      location: { select: { id: true, name: true, timezone: true } },
      requiredSkills: { select: { skillId: true } },
      assignments: { select: { userId: true } },
    },
  });

  if (!shift) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Shift not found" },
      { status: 404 }
    );
  }

  const requiredSkillIds = shift.requiredSkills.map((s) => s.skillId);
  const assignedUserIds = new Set(shift.assignments.map((a) => a.userId));

  // Staff with valid cert for location (exclude already assigned; assign API enforces skills, availability, conflicts)
  const certUsers = await prisma.certification.findMany({
    where: {
      locationId: shift.locationId,
      expiresAt: { gt: new Date() },
      user: {
        isActive: true,
        role: { in: ["STAFF", "MANAGER"] },
      },
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const certUserMap = new Map<string, { id: string; name: string; email: string }>();
  for (const c of certUsers) {
    certUserMap.set(c.userId, c.user);
  }

  const qualified: {
    id: string;
    name: string;
    email: string;
    role: string;
    skills: { id: string; name: string }[];
    certifications: { id: string; locationId: string; locationName: string; expiresAt: string }[];
    hasRequiredSkills: boolean;
  }[] = [];

  for (const [userId, user] of certUserMap) {
    if (assignedUserIds.has(userId)) continue;

    const staffSkills = await prisma.staffSkill.findMany({
      where: { userId },
      include: { skill: { select: { id: true, name: true } } },
    });

    const userSkillIds = staffSkills.map((ss) => ss.skill.id);
    const hasRequiredSkills =
      requiredSkillIds.length === 0 ||
      requiredSkillIds.every((rid) => userSkillIds.includes(rid));

    const certs = certUsers.filter((c) => c.userId === userId);
    qualified.push({
      id: user.id,
      name: user.name,
      email: user.email,
      role: "STAFF",
      skills: staffSkills.map((ss) => ({ id: ss.skill.id, name: ss.skill.name })),
      certifications: certs.map((c) => ({
        id: c.id,
        locationId: c.locationId,
        locationName: shift.location.name,
        expiresAt: c.expiresAt.toISOString(),
      })),
      hasRequiredSkills,
    });
  }

  return NextResponse.json({
    staff: qualified.sort((a, b) => a.name.localeCompare(b.name)),
  });
}
