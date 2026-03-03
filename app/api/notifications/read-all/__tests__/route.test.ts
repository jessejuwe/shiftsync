/**
 * Unit tests for POST /api/notifications/read-all
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("POST /api/notifications/read-all", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/notifications/read-all", {
      method: "POST",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("marks all notifications as read", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

    const req = new NextRequest("http://localhost/api/notifications/read-all", {
      method: "POST",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", readAt: null },
      data: expect.any(Object),
    });
  });
});
