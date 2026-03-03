/**
 * Unit tests for ShiftsManager component.
 */

import { render, screen, waitFor } from "@/components/features/__tests__/test-utils";
import { ShiftsManager } from "../shifts-manager";

jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: { id: "manager1", email: "manager@x.com", role: "MANAGER" },
    },
    status: "authenticated",
  }),
}));

jest.mock("@/hooks/use-realtime-schedule", () => ({
  useRealtimeSchedule: () => {},
}));

describe("ShiftsManager", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("shows Shifts title and description for manager", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/shifts?"))
        return Promise.resolve({
          ok: true,
          json: async () => ({ shifts: [] }),
        });
      if (url.includes("/api/locations"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      if (url.includes("/api/skills"))
        return Promise.resolve({ ok: true, json: async () => ({ skills: [] }) });
      if (url.includes("/api/shifts/on-duty"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      return Promise.reject(new Error(`Unknown: ${url}`));
    });

    render(<ShiftsManager />);

    await waitFor(() => {
      expect(screen.getByText("Shifts")).toBeInTheDocument();
      expect(screen.getByText(/Create shifts and assign staff/)).toBeInTheDocument();
    });
  });

  it("shows Create shift button for manager", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/shifts?"))
        return Promise.resolve({ ok: true, json: async () => ({ shifts: [] }) });
      if (url.includes("/api/locations"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      if (url.includes("/api/skills"))
        return Promise.resolve({ ok: true, json: async () => ({ skills: [] }) });
      if (url.includes("/api/shifts/on-duty"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      return Promise.reject(new Error(`Unknown: ${url}`));
    });

    render(<ShiftsManager />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create shift/i })).toBeInTheDocument();
    });
  });

  it("shows Loading shifts when fetching", async () => {
    let resolveShifts!: (value: unknown) => void;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/shifts?") && !url.includes("on-duty"))
        return new Promise<unknown>((r) => { resolveShifts = r; });
      if (url.includes("/api/locations"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      if (url.includes("/api/skills"))
        return Promise.resolve({ ok: true, json: async () => ({ skills: [] }) });
      if (url.includes("/api/shifts/on-duty"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      return Promise.reject(new Error(`Unknown: ${url}`));
    });

    render(<ShiftsManager />);

    expect(screen.getByText("Loading shifts...")).toBeInTheDocument();

    resolveShifts({ ok: true, json: async () => ({ shifts: [] }) });
  });

  it("shows No shifts this week when empty", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/shifts?"))
        return Promise.resolve({ ok: true, json: async () => ({ shifts: [] }) });
      if (url.includes("/api/locations"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      if (url.includes("/api/skills"))
        return Promise.resolve({ ok: true, json: async () => ({ skills: [] }) });
      if (url.includes("/api/shifts/on-duty"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      return Promise.reject(new Error(`Unknown: ${url}`));
    });

    render(<ShiftsManager />);

    await waitFor(() => {
      expect(screen.getByText(/No shifts this week/)).toBeInTheDocument();
    });
  });
});
