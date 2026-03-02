import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const includeExpired = searchParams.get("includeExpired") === "1";

  const certWhere: { locationId?: string; expiresAt?: { gt: Date } } = {};
  if (locationId) certWhere.locationId = locationId;
  if (!includeExpired) certWhere.expiresAt = { gt: new Date() };

  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["STAFF", "MANAGER"] } },
    include: {
      staffSkills: {
        include: { skill: { select: { id: true, name: true } } },
      },
      certifications: {
        where: Object.keys(certWhere).length > 0 ? certWhere : undefined,
        include: { location: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    staff: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      skills: u.staffSkills.map((ss) => ({
        id: ss.skill.id,
        name: ss.skill.name,
      })),
      certifications: u.certifications.map((c) => ({
        id: c.id,
        locationId: c.locationId,
        locationName: c.location.name,
        expiresAt: c.expiresAt.toISOString(),
      })),
    })),
  });
}
