/**
 * Unit tests for GET and POST /api/availability
 */

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("GET /api/availability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/availability");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns own windows when staff", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });
    (prisma.availabilityWindow.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/availability");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.windows).toEqual([]);
    expect(prisma.availabilityWindow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
      })
    );
  });

  it("returns 403 when staff tries to view another user", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });

    const req = new NextRequest("http://localhost/api/availability?userId=u2");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("allows manager to view other user", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "m1", role: "MANAGER" },
    });
    (prisma.availabilityWindow.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/availability?userId=u2");
    await GET(req);

    expect(prisma.availabilityWindow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u2" },
      })
    );
  });
});

describe("POST /api/availability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/availability", {
      method: "POST",
      body: JSON.stringify({
        locationId: "loc1",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when locationId missing", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });

    const req = new NextRequest("http://localhost/api/availability", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_FIELDS");
  });

  it("returns 404 when location not found", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });
    (prisma.location.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.certification.findFirst as jest.Mock).mockResolvedValue({});

    const req = new NextRequest("http://localhost/api/availability", {
      method: "POST",
      body: JSON.stringify({
        locationId: "bad-loc",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns 400 when user not certified at location", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });
    (prisma.location.findUnique as jest.Mock).mockResolvedValue({
      id: "loc1",
      timezone: "America/New_York",
    });
    (prisma.certification.findFirst as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/availability", {
      method: "POST",
      body: JSON.stringify({
        locationId: "loc1",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("CERTIFICATION_REQUIRED");
  });
});
