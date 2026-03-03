/**
 * Unit tests for SwapRequestsPanel component.
 */

import { render, screen, fireEvent, waitFor } from "@/components/features/__tests__/test-utils";
import { SwapRequestsPanel } from "../swap-requests-panel";

describe("SwapRequestsPanel", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("does not render panel when loading", () => {
    let resolveFetch!: (value: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise<unknown>((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<SwapRequestsPanel currentUserId="u1" />);

    expect(screen.queryByText("Swap requests")).not.toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => ({ swapRequests: [] }),
    });
  });

  it("does not render panel when no swap requests", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ swapRequests: [] }),
    });

    render(<SwapRequestsPanel currentUserId="u1" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(screen.queryByText("Swap requests")).not.toBeInTheDocument();
  });

  it("renders swap requests when data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        swapRequests: [
          {
            id: "sr1",
            status: "PENDING",
            message: "Can we swap?",
            createdAt: "2025-01-15T10:00:00.000Z",
            respondedAt: null,
            initiatorId: "u2",
            initiator: { id: "u2", name: "Bob", email: "bob@x.com" },
            receiverId: "u1",
            receiver: { id: "u1", name: "Alice", email: "alice@x.com" },
            initiatorShiftId: "as1",
            receiverShiftId: null,
            initiatorShift: {
              id: "as1",
              shiftId: "s1",
              shift: {
                id: "s1",
                startsAt: "2025-01-20T14:00:00.000Z",
                endsAt: "2025-01-20T22:00:00.000Z",
                location: { id: "loc1", name: "Downtown Bar", timezone: "America/New_York" },
              },
              user: { id: "u2", name: "Bob" },
            },
          },
        ],
      }),
    });

    render(<SwapRequestsPanel currentUserId="u1" />);

    await waitFor(() => {
      expect(screen.getByText("Swap requests")).toBeInTheDocument();
      expect(screen.getByText(/Bob wants to swap/)).toBeInTheDocument();
      expect(screen.getByText(/Downtown Bar/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
    });
  });
});
