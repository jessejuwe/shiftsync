/**
 * Unit tests for GET /api/shifts/[id]/qualified-staff
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("GET /api/shifts/[id]/qualified-staff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when not admin or manager", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest(
      "http://localhost/api/shifts/s1/qualified-staff"
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "s1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 403 when staff", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });

    const req = new NextRequest(
      "http://localhost/api/shifts/s1/qualified-staff"
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "s1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 404 when shift not found", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "m1", role: "MANAGER" },
    });
    (prisma.shift.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest(
      "http://localhost/api/shifts/bad-id/qualified-staff"
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "bad-id" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns qualified staff when manager", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "m1", role: "MANAGER" },
    });
    (prisma.shift.findUnique as jest.Mock).mockResolvedValue({
      id: "s1",
      locationId: "loc1",
      location: { id: "loc1", name: "Downtown", timezone: "America/New_York" },
      requiredSkills: [],
      assignments: [],
    });
    (prisma.certification.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.staffSkill.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest(
      "http://localhost/api/shifts/s1/qualified-staff"
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "s1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.staff).toBeDefined();
  });

  it("excludes staff already assigned to the shift", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "m1", role: "MANAGER" },
    });
    (prisma.shift.findUnique as jest.Mock).mockResolvedValue({
      id: "s1",
      locationId: "loc1",
      location: { id: "loc1", name: "Downtown", timezone: "America/New_York" },
      requiredSkills: [],
      assignments: [{ userId: "u1" }],
    });
    (prisma.certification.findMany as jest.Mock).mockResolvedValue([
      {
        userId: "u1",
        locationId: "loc1",
        expiresAt: new Date("2026-12-31"),
        user: { id: "u1", name: "Alice", email: "a@x.com" },
      },
      {
        userId: "u2",
        locationId: "loc1",
        expiresAt: new Date("2026-12-31"),
        user: { id: "u2", name: "Bob", email: "b@x.com" },
      },
    ]);
    (prisma.staffSkill.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest(
      "http://localhost/api/shifts/s1/qualified-staff"
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "s1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.staff).toHaveLength(1);
    expect(body.staff[0].id).toBe("u2");
  });
});
