/**
 * Unit tests for StaffAvailabilityOverview component.
 */

import { render, screen, waitFor } from "@/components/features/__tests__/test-utils";
import { StaffAvailabilityOverview } from "../staff-availability-overview";

describe("StaffAvailabilityOverview", () => {
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

    render(<StaffAvailabilityOverview />);

    expect(screen.getByText("Loading staff availability…")).toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => ({ staff: [] }),
    });
  });

  it("shows No staff found when empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ staff: [] }),
    });

    render(<StaffAvailabilityOverview />);

    await waitFor(() => {
      expect(screen.getByText("No staff found.")).toBeInTheDocument();
    });
  });

  it("renders staff with availability", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        staff: [
          {
            id: "u1",
            name: "Alice Smith",
            email: "alice@x.com",
            role: "STAFF",
            desiredHoursPerWeek: 40,
            windows: [
              {
                id: "w1",
                userId: "u1",
                locationId: "loc1",
                location: { id: "loc1", name: "Downtown Bar", timezone: "America/New_York" },
                startsAt: "2024-01-15T14:00:00.000Z",
                endsAt: "2024-01-15T22:00:00.000Z",
                dayOfWeek: 1,
                isRecurring: true,
              },
            ],
          },
        ],
      }),
    });

    render(<StaffAvailabilityOverview />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("alice@x.com")).toBeInTheDocument();
      expect(screen.getByText(/Downtown Bar/)).toBeInTheDocument();
      expect(screen.getByText("Monday")).toBeInTheDocument();
    });
  });

  it("shows Manager badge for manager role", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        staff: [
          {
            id: "u1",
            name: "Bob Manager",
            email: "bob@x.com",
            role: "MANAGER",
            windows: [],
          },
        ],
      }),
    });

    render(<StaffAvailabilityOverview />);

    await waitFor(() => {
      expect(screen.getByText("Manager")).toBeInTheDocument();
    });
  });
});
