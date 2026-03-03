/**
 * Unit tests for GET /api/availability/all
 */

import { GET } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("GET /api/availability/all", () => {
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

  it("returns 403 when staff", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns staff with windows when admin", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "a1", role: "ADMIN" },
    });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: "u1",
        name: "Alice",
        email: "a@test.com",
        role: "STAFF",
        desiredHoursPerWeek: 40,
        availabilityWindows: [],
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.staff).toHaveLength(1);
    expect(body.staff[0].name).toBe("Alice");
  });
});
