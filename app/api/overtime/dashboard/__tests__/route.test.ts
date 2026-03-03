/**
 * Unit tests for GET /api/overtime/dashboard
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma");

describe("GET /api/overtime/dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns staff hours data", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "u1", name: "Alice", email: "a@test.com" },
    ]);
    (prisma.shiftAssignment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.location.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/overtime/dashboard");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.staff).toBeDefined();
    expect(body.weekStart).toBeDefined();
    expect(body.weekEnd).toBeDefined();
    expect(prisma.user.findMany).toHaveBeenCalled();
  });

  it("filters by locationId when provided", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "u1", name: "Alice", email: "a@test.com" },
    ]);
    (prisma.shiftAssignment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.location.findUnique as jest.Mock).mockResolvedValue({
      hourlyRate: 25,
    });

    const req = new NextRequest(
      "http://localhost/api/overtime/dashboard?locationId=loc1"
    );
    await GET(req);

    expect(prisma.shiftAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shift: expect.objectContaining({ locationId: "loc1" }),
        }),
      })
    );
  });
});
