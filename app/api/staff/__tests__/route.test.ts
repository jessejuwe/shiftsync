/**
 * Unit tests for GET /api/staff
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma");

describe("GET /api/staff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns staff with skills and certifications", async () => {
    const mockUsers = [
      {
        id: "u1",
        name: "Alice Smith",
        email: "alice@x.com",
        role: "STAFF",
        staffSkills: [{ skill: { id: "s1", name: "Bartender" } }],
        certifications: [
          {
            id: "c1",
            locationId: "loc1",
            location: { id: "loc1", name: "Downtown Bar" },
            expiresAt: new Date("2025-12-31"),
          },
        ],
      },
    ];
    (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

    const req = new NextRequest("http://localhost/api/staff");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.staff).toHaveLength(1);
    expect(body.staff[0]).toMatchObject({
      id: "u1",
      name: "Alice Smith",
      email: "alice@x.com",
      role: "STAFF",
    });
    expect(body.staff[0].skills).toEqual([{ id: "s1", name: "Bartender" }]);
    expect(body.staff[0].certifications).toHaveLength(1);
  });

  it("filters by locationId when provided", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/staff?locationId=loc1");
    await GET(req);

    expect(prisma.user.findMany).toHaveBeenCalled();
    const call = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
    expect(call.include.certifications.where).toMatchObject({
      locationId: "loc1",
    });
  });
});
