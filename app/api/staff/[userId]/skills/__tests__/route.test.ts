/**
 * Unit tests for POST /api/staff/[userId]/skills
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("POST /api/staff/[userId]/skills", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/staff/u1/skills", {
      method: "POST",
      body: JSON.stringify({ skillId: "sk1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when staff", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });

    const req = new NextRequest("http://localhost/api/staff/u1/skills", {
      method: "POST",
      body: JSON.stringify({ skillId: "sk1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 400 when skillId missing", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "m1", role: "MANAGER" },
    });

    const req = new NextRequest("http://localhost/api/staff/u1/skills", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_FIELDS");
  });

  it("returns 404 when user not found", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "m1", role: "MANAGER" },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.skill.findUnique as jest.Mock).mockResolvedValue({
      id: "sk1",
      name: "Bartender",
    });

    const req = new NextRequest("http://localhost/api/staff/bad-user/skills", {
      method: "POST",
      body: JSON.stringify({ skillId: "sk1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ userId: "bad-user" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("creates staff skill when valid", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "m1", role: "MANAGER" },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "u1",
      name: "Alice",
    });
    (prisma.skill.findUnique as jest.Mock).mockResolvedValue({
      id: "sk1",
      name: "Bartender",
    });
    (prisma.staffSkill.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.staffSkill.create as jest.Mock).mockResolvedValue({
      id: "ss1",
      skill: { id: "sk1", name: "Bartender" },
    });

    const req = new NextRequest("http://localhost/api/staff/u1/skills", {
      method: "POST",
      body: JSON.stringify({ skillId: "sk1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.staffSkill).toBeDefined();
    expect(body.staffSkill.skill.name).toBe("Bartender");
  });
});
