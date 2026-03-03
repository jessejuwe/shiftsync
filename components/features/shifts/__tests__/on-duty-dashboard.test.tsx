/**
 * Unit tests for OnDutyDashboard component.
 */

import { render, screen, waitFor } from "@/components/features/__tests__/test-utils";
import { OnDutyDashboard } from "../on-duty-dashboard";

describe("OnDutyDashboard", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("shows Loading when fetching", async () => {
    let resolveFetch!: (value: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise<unknown>((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<OnDutyDashboard />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    resolveFetch({ ok: true, json: async () => ({ locations: [] }) });
  });

  it("shows On duty now title", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ locations: [] }),
    });

    render(<OnDutyDashboard />);

    await waitFor(() => {
      expect(screen.getByText("On duty now")).toBeInTheDocument();
    });
  });

  it("shows No one is currently on shift when empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ locations: [] }),
    });

    render(<OnDutyDashboard />);

    await waitFor(() => {
      expect(screen.getByText("No one is currently on shift")).toBeInTheDocument();
    });
  });

  it("renders location and staff when data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        locations: [
          {
            location: {
              id: "loc1",
              name: "Downtown Bar",
              timezone: "America/New_York",
            },
            staff: [
              {
                id: "a1",
                userId: "u1",
                userName: "Alice Smith",
                userEmail: "alice@x.com",
                shiftStartsAt: "2025-01-15T14:00:00.000Z",
                shiftEndsAt: "2025-01-15T22:00:00.000Z",
              },
            ],
          },
        ],
      }),
    });

    render(<OnDutyDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Downtown Bar")).toBeInTheDocument();
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
  });
});
