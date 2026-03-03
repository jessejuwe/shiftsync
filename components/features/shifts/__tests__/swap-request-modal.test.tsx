/**
 * Unit tests for SwapRequestModal component.
 */

import { render, screen, fireEvent, waitFor } from "@/components/features/__tests__/test-utils";
import { SwapRequestModal } from "../swap-request-modal";

const assignment = {
  id: "a1",
  userId: "u1",
  user: { id: "u1", name: "Alice Smith", email: "alice@x.com" },
  shiftId: "shift1",
};

const shifts = [
  {
    id: "shift1",
    locationId: "loc1",
    location: { id: "loc1", name: "Downtown Bar" },
    assignments: [
      { id: "a1", userId: "u1", user: { id: "u1", name: "Alice Smith" } },
    ],
  },
  {
    id: "shift2",
    locationId: "loc1",
    location: { id: "loc1", name: "Downtown Bar" },
    assignments: [
      { id: "a2", userId: "u2", user: { id: "u2", name: "Bob Jones" } },
    ],
  },
];

describe("SwapRequestModal", () => {
  const mockFetch = jest.fn();
  const onOpenChange = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    onOpenChange.mockImplementation(() => {});
  });

  it("returns null when assignment is null", () => {
    render(
      <SwapRequestModal
        open={true}
        onOpenChange={onOpenChange}
        assignment={null}
        shifts={[]}
        currentUserId="u1"
        onSuccess={onSuccess}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders Request swap title when open with assignment", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ staff: [{ id: "u2", name: "Bob Jones", email: "bob@x.com" }] }),
    });

    render(
      <SwapRequestModal
        open={true}
        onOpenChange={onOpenChange}
        assignment={assignment}
        shifts={shifts}
        currentUserId="u1"
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Request swap" })).toBeInTheDocument();
      expect(screen.getByText(/Request to swap your shift with another staff member/)).toBeInTheDocument();
    });
  });

  it("renders staff select and message fields", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ staff: [{ id: "u2", name: "Bob Jones", email: "bob@x.com" }] }),
    });

    render(
      <SwapRequestModal
        open={true}
        onOpenChange={onOpenChange}
        assignment={assignment}
        shifts={shifts}
        currentUserId="u1"
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Staff member")).toBeInTheDocument();
      expect(screen.getByText("Message (optional)")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^request swap$/i })).toBeInTheDocument();
    });
  });

  it("calls onOpenChange when Cancel clicked", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ staff: [] }),
    });

    render(
      <SwapRequestModal
        open={true}
        onOpenChange={onOpenChange}
        assignment={assignment}
        shifts={shifts}
        currentUserId="u1"
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
