/**
 * Unit tests for POST /api/shifts/publish
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");
jest.mock("@/lib/pusher-events", () => ({
  broadcastSchedulePublished: jest.fn(),
}));

describe("POST /api/shifts/publish", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when not admin or manager", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });

    const req = new NextRequest("http://localhost/api/shifts/publish", {
      method: "POST",
      body: JSON.stringify({ locationId: "loc1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 400 when locationId missing", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });

    const req = new NextRequest("http://localhost/api/shifts/publish", {
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
      user: { id: "u1", role: "ADMIN" },
    });
    (prisma.location.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/shifts/publish", {
      method: "POST",
      body: JSON.stringify({ locationId: "bad-loc" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("publishes schedule when valid", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    (prisma.location.findUnique as jest.Mock).mockResolvedValue({
      id: "loc1",
      name: "Downtown",
    });
    (prisma.shift.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

    const req = new NextRequest("http://localhost/api/shifts/publish", {
      method: "POST",
      body: JSON.stringify({ locationId: "loc1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.shift.updateMany).toHaveBeenCalled();
  });
});
