/**
 * Unit tests for GET /api/availability/certified-locations
 */

import { GET } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("GET /api/availability/certified-locations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns certified locations when authenticated", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.certification.findMany as jest.Mock).mockResolvedValue([
      {
        location: {
          id: "loc1",
          name: "Downtown",
          timezone: "America/New_York",
        },
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.locations).toHaveLength(1);
    expect(body.locations[0].name).toBe("Downtown");
  });
});
