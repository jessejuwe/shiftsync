/**
 * Unit tests for GET /api/shifts/on-duty
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("GET /api/shifts/on-duty", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/shifts/on-duty");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns locations with on-duty staff", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.shiftAssignment.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/shifts/on-duty");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.locations).toEqual([]);
    expect(body.fetchedAt).toBeDefined();
  });

  it("filters by locationId when provided", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.shiftAssignment.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest(
      "http://localhost/api/shifts/on-duty?locationId=loc1"
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
