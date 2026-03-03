/**
 * Unit tests for StaffManager (staff-skills-manager) component.
 */

import { render, screen, waitFor } from "@/components/features/__tests__/test-utils";
import { StaffManager } from "../staff-skills-manager";

describe("StaffManager", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("shows Loading when fetching staff", () => {
    let resolveStaff!: (value: unknown) => void;
    let resolveLocations!: (value: unknown) => void;
    let resolveSkills!: (value: unknown) => void;

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/staff")) return new Promise<unknown>((r) => { resolveStaff = r; });
      if (url.includes("/api/locations")) return new Promise<unknown>((r) => { resolveLocations = r; });
      if (url.includes("/api/skills")) return new Promise<unknown>((r) => { resolveSkills = r; });
      return Promise.reject(new Error("Unknown"));
    });

    render(<StaffManager />);

    expect(screen.getByText("Loading staff…")).toBeInTheDocument();

    resolveStaff({ ok: true, json: async () => ({ staff: [] }) });
    resolveLocations({ ok: true, json: async () => ({ locations: [] }) });
    resolveSkills({ ok: true, json: async () => ({ skills: [] }) });
  });

  it("renders staff cards when data loaded", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/staff?") || url.includes("includeExpired"))
        return Promise.resolve({
          ok: true,
          json: async () => ({
            staff: [
              {
                id: "u1",
                name: "Alice Smith",
                email: "alice@x.com",
                role: "STAFF",
                skills: [{ id: "s1", name: "Bartender" }],
                certifications: [],
              },
            ],
          }),
        });
      if (url.includes("/api/locations"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      if (url === "/api/skills" || (url.includes("/api/skills") && !url.includes("/api/staff")))
        return Promise.resolve({ ok: true, json: async () => ({ skills: [] }) });
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    render(<StaffManager />);

    await waitFor(
      () => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
        expect(screen.getByText("alice@x.com")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
