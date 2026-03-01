import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  let body: {
    locationId: string;
    startsAt: string;
    endsAt: string;
    title?: string;
    notes?: string;
    requiredSkillIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { locationId, startsAt, endsAt, title, notes, requiredSkillIds } = body;

  if (!locationId || !startsAt || !endsAt) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "locationId, startsAt, and endsAt are required" },
      { status: 400 }
    );
  }

  const startsAtDate = new Date(startsAt);
  const endsAtDate = new Date(endsAt);

  if (isNaN(startsAtDate.getTime()) || isNaN(endsAtDate.getTime())) {
    return NextResponse.json(
      { code: "INVALID_DATES", message: "Invalid date format" },
      { status: 400 }
    );
  }

  if (endsAtDate <= startsAtDate) {
    return NextResponse.json(
      { code: "INVALID_RANGE", message: "endsAt must be after startsAt" },
      { status: 400 }
    );
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Location not found" },
      { status: 404 }
    );
  }

  try {
    const shift = await prisma.shift.create({
      data: {
        locationId,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        title: title ?? null,
        notes: notes ?? null,
        requiredSkills:
          requiredSkillIds?.length
            ? { create: requiredSkillIds.map((skillId) => ({ skillId })) }
            : undefined,
      },
      include: {
        location: { select: { id: true, name: true, timezone: true } },
        requiredSkills: { include: { skill: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json(
      {
        shift: {
          id: shift.id,
          locationId: shift.locationId,
          location: shift.location,
          startsAt: shift.startsAt.toISOString(),
          endsAt: shift.endsAt.toISOString(),
          title: shift.title,
          notes: shift.notes,
          isPublished: shift.isPublished,
          requiredSkills: shift.requiredSkills.map((ss) => ({
            id: ss.skill.id,
            name: ss.skill.name,
          })),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Shift create error:", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Failed to create shift" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (locationId) where.locationId = locationId;
  if (from || to) {
    where.startsAt = {};
    if (from) (where.startsAt as Record<string, Date>).gte = new Date(from);
    if (to) (where.startsAt as Record<string, Date>).lte = new Date(to);
  }

  const shifts = await prisma.shift.findMany({
    where,
    include: {
      location: { select: { id: true, name: true, timezone: true } },
      requiredSkills: { include: { skill: { select: { id: true, name: true } } } },
      assignments: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return NextResponse.json({
    shifts: shifts.map((s) => ({
      id: s.id,
      locationId: s.locationId,
      location: s.location,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      title: s.title,
      notes: s.notes,
      isPublished: s.isPublished,
      requiredSkills: s.requiredSkills.map((ss) => ({ id: ss.skill.id, name: ss.skill.name })),
      assignments: s.assignments.map((a) => ({
        id: a.id,
        userId: a.userId,
        user: a.user,
        status: a.status,
      })),
    })),
  });
}
