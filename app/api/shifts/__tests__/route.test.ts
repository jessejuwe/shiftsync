/**
 * Unit tests for POST and GET /api/shifts
 */

import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("POST /api/shifts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/shifts", {
      method: "POST",
      body: JSON.stringify({
        locationId: "loc1",
        startsAt: "2024-01-15T09:00:00Z",
        endsAt: "2024-01-15T17:00:00Z",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when not admin or manager", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });

    const req = new NextRequest("http://localhost/api/shifts", {
      method: "POST",
      body: JSON.stringify({
        locationId: "loc1",
        startsAt: "2024-01-15T09:00:00Z",
        endsAt: "2024-01-15T17:00:00Z",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 400 when missing required fields", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });

    const req = new NextRequest("http://localhost/api/shifts", {
      method: "POST",
      body: JSON.stringify({ locationId: "loc1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_FIELDS");
  });

  it("returns 400 when endsAt is before startsAt", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });

    const req = new NextRequest("http://localhost/api/shifts", {
      method: "POST",
      body: JSON.stringify({
        locationId: "loc1",
        startsAt: "2024-01-15T17:00:00Z",
        endsAt: "2024-01-15T09:00:00Z",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_RANGE");
  });

  it("returns 201 and shift when valid", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    const mockShift = {
      id: "shift1",
      locationId: "loc1",
      location: { id: "loc1", name: "Downtown", timezone: "America/New_York" },
      startsAt: new Date("2024-01-15T09:00:00Z"),
      endsAt: new Date("2024-01-15T17:00:00Z"),
      title: null,
      notes: null,
      headcount: 1,
      isPublished: false,
      requiredSkills: [],
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
      const tx = {
        location: { findUnique: jest.fn().mockResolvedValue({ id: "loc1" }) },
        skill: { findMany: jest.fn().mockResolvedValue([]) },
        shift: { create: jest.fn().mockResolvedValue(mockShift) },
      };
      return fn(tx);
    });

    const req = new NextRequest("http://localhost/api/shifts", {
      method: "POST",
      body: JSON.stringify({
        locationId: "loc1",
        startsAt: "2024-01-15T09:00:00Z",
        endsAt: "2024-01-15T17:00:00Z",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.shift).toBeDefined();
    expect(body.shift.id).toBe("shift1");
  });
});

describe("GET /api/shifts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/shifts");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns shifts when authenticated", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    (prisma.shift.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/shifts");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shifts).toEqual([]);
  });
});
