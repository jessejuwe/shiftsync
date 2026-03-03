/**
 * Unit tests for POST /api/staff/[userId]/certifications
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("POST /api/staff/[userId]/certifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest(
      "http://localhost/api/staff/u1/certifications",
      {
        method: "POST",
        body: JSON.stringify({ locationId: "loc1" }),
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when staff", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });

    const req = new NextRequest(
      "http://localhost/api/staff/u1/certifications",
      {
        method: "POST",
        body: JSON.stringify({ locationId: "loc1" }),
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 400 when locationId missing", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "m1", role: "MANAGER" },
    });

    const req = new NextRequest(
      "http://localhost/api/staff/u1/certifications",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_FIELDS");
  });

  it("returns 404 when user not found", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "m1", role: "MANAGER" },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.location.findUnique as jest.Mock).mockResolvedValue({
      id: "loc1",
      name: "Downtown",
    });

    const req = new NextRequest(
      "http://localhost/api/staff/bad-user/certifications",
      {
        method: "POST",
        body: JSON.stringify({ locationId: "loc1" }),
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req, {
      params: Promise.resolve({ userId: "bad-user" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("creates certification when valid", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "m1", role: "MANAGER" },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "u1",
      name: "Alice",
    });
    (prisma.location.findUnique as jest.Mock).mockResolvedValue({
      id: "loc1",
      name: "Downtown",
    });
    (prisma.certification.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.certification.create as jest.Mock).mockResolvedValue({
      id: "c1",
      locationId: "loc1",
      location: { id: "loc1", name: "Downtown" },
      name: "Location cert",
      issuedAt: new Date(),
      expiresAt: new Date(),
    });

    const req = new NextRequest(
      "http://localhost/api/staff/u1/certifications",
      {
        method: "POST",
        body: JSON.stringify({ locationId: "loc1" }),
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.certification).toBeDefined();
    expect(body.certification.locationId).toBe("loc1");
  });
});
