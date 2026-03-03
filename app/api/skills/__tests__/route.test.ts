/**
 * Unit tests for GET /api/skills
 */

import { GET } from "../route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma");

describe("GET /api/skills", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns skills from prisma", async () => {
    const mockSkills = [
      { id: "s1", name: "Bartender", description: "Bar skills" },
      { id: "s2", name: "Server", description: null },
    ];
    (prisma.skill.findMany as jest.Mock).mockResolvedValue(mockSkills);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.skills).toHaveLength(2);
    expect(body.skills[0]).toEqual({
      id: "s1",
      name: "Bartender",
      description: "Bar skills",
    });
    expect(body.skills[1]).toEqual({
      id: "s2",
      name: "Server",
      description: null,
    });
    expect(prisma.skill.findMany).toHaveBeenCalledWith({
      orderBy: { name: "asc" },
    });
  });

  it("returns empty array when no skills", async () => {
    (prisma.skill.findMany as jest.Mock).mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.skills).toEqual([]);
  });
});
