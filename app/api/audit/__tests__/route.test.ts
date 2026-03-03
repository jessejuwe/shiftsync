/**
 * Unit tests for GET /api/audit
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("GET /api/audit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when not admin", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });

    const req = new NextRequest("http://localhost/api/audit");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
    expect(body.message).toBe("Admin access required");
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/audit");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns entries when admin", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/audit");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.entries).toEqual([]);
    expect(prisma.auditLog.findMany).toHaveBeenCalled();
  });

  it("passes locationId filter when provided", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/audit?locationId=loc1");
    await GET(req);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ locationId: "loc1" }),
      })
    );
  });
});
