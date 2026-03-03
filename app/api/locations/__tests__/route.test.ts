/**
 * Unit tests for GET /api/locations
 */

import { GET } from "../route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma");

describe("GET /api/locations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns locations from prisma", async () => {
    const mockLocations = [
      {
        id: "loc1",
        name: "Downtown Bar",
        address: "123 Main St",
        timezone: "America/New_York",
      },
    ];
    (prisma.location.findMany as jest.Mock).mockResolvedValue(mockLocations);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.locations).toHaveLength(1);
    expect(body.locations[0]).toEqual({
      id: "loc1",
      name: "Downtown Bar",
      address: "123 Main St",
      timezone: "America/New_York",
    });
    expect(prisma.location.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  });

  it("returns empty array when no locations", async () => {
    (prisma.location.findMany as jest.Mock).mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.locations).toEqual([]);
  });
});
