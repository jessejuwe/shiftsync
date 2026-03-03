/**
 * Unit tests for ShiftCard component.
 */

import { render, screen, fireEvent } from "@/components/features/__tests__/test-utils";
import { ShiftCard, type ShiftCardActions } from "../shift-card";
import type { Shift } from "../types";

jest.mock("@/config/schedule", () => ({
  canUnpublishOrEdit: jest.fn(() => true),
  SCHEDULE_CONFIG: { unpublishEditCutoffHours: 48 },
}));

const createShift = (overrides: Partial<Shift> = {}): Shift => ({
  id: "shift1",
  locationId: "loc1",
  location: { id: "loc1", name: "Downtown Bar", timezone: "America/New_York" },
  startsAt: "2025-06-15T14:00:00.000Z",
  endsAt: "2025-06-15T22:00:00.000Z",
  title: null,
  notes: null,
  headcount: 2,
  isPublished: false,
  requiredSkills: [{ id: "s1", name: "Bartender" }],
  assignments: [],
  ...overrides,
});

const createActions = (overrides: Partial<ShiftCardActions> = {}): ShiftCardActions => ({
  onEdit: jest.fn(),
  onAssignStaff: jest.fn(),
  onUnassign: jest.fn(),
  onPublish: jest.fn(),
  onUnpublish: jest.fn(),
  onClockIn: jest.fn(),
  onClockOut: jest.fn(),
  onRequestSwap: jest.fn(),
  onOfferUp: jest.fn(),
  onPickup: jest.fn(),
  isUnassignPending: false,
  isPublishPending: false,
  isUnpublishPending: false,
  isClockInPending: false,
  isClockOutPending: false,
  ...overrides,
});

describe("ShiftCard", () => {
  const actions = createActions();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-06-10T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders shift time and location", () => {
    const shift = createShift();
    render(
      <ShiftCard
        shift={shift}
        canManage={true}
        isStaff={false}
        currentUserId={null}
        actions={actions}
      />
    );
    expect(screen.getByText(/Jun 15/)).toBeInTheDocument();
    expect(screen.getByText("Downtown Bar")).toBeInTheDocument();
  });

  it("shows Draft badge when not published", () => {
    const shift = createShift({ isPublished: false });
    render(
      <ShiftCard
        shift={shift}
        canManage={true}
        isStaff={false}
        currentUserId={null}
        actions={actions}
      />
    );
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows Published badge when published", () => {
    const shift = createShift({ isPublished: true });
    render(
      <ShiftCard
        shift={shift}
        canManage={true}
        isStaff={false}
        currentUserId={null}
        actions={actions}
      />
    );
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("shows Past badge when shift has ended", () => {
    const shift = createShift({
      startsAt: "2025-06-01T14:00:00.000Z",
      endsAt: "2025-06-01T22:00:00.000Z",
    });
    render(
      <ShiftCard
        shift={shift}
        canManage={true}
        isStaff={false}
        currentUserId={null}
        actions={actions}
      />
    );
    expect(screen.getByText("Past")).toBeInTheDocument();
  });

  it("renders required skills", () => {
    const shift = createShift();
    render(
      <ShiftCard
        shift={shift}
        canManage={true}
        isStaff={false}
        currentUserId={null}
        actions={actions}
      />
    );
    expect(screen.getByText("Bartender")).toBeInTheDocument();
  });

  it("shows assigned count", () => {
    const shift = createShift({
      assignments: [
        {
          id: "a1",
          userId: "u1",
          user: { id: "u1", name: "Alice", email: "a@x.com" },
          status: "ASSIGNED",
          clockedInAt: null,
          clockedOutAt: null,
        },
      ],
    });
    render(
      <ShiftCard
        shift={shift}
        canManage={true}
        isStaff={false}
        currentUserId={null}
        actions={actions}
      />
    );
    expect(screen.getByText(/Assigned: 1\/2/)).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("calls onPublish when Publish clicked (manager, draft)", () => {
    const shift = createShift({ isPublished: false });
    render(
      <ShiftCard
        shift={shift}
        canManage={true}
        isStaff={false}
        currentUserId={null}
        actions={actions}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));
    expect(actions.onPublish).toHaveBeenCalledWith("loc1", ["shift1"]);
  });

  it("calls onAssignStaff when Assign staff clicked", () => {
    const shift = createShift();
    render(
      <ShiftCard
        shift={shift}
        canManage={true}
        isStaff={false}
        currentUserId={null}
        actions={actions}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /assign staff/i }));
    expect(actions.onAssignStaff).toHaveBeenCalledWith(shift);
  });

  it("disables Assign staff when shift is full", () => {
    const shift = createShift({
      headcount: 1,
      assignments: [
        {
          id: "a1",
          userId: "u1",
          user: { id: "u1", name: "Alice", email: "a@x.com" },
          status: "ASSIGNED",
          clockedInAt: null,
          clockedOutAt: null,
        },
      ],
    });
    render(
      <ShiftCard
        shift={shift}
        canManage={true}
        isStaff={false}
        currentUserId={null}
        actions={actions}
      />
    );
    const assignBtn = screen.getByRole("button", { name: /assign staff/i });
    expect(assignBtn).toBeDisabled();
  });

  it("calls onUnassign when unassign button clicked", () => {
    const shift = createShift({
      assignments: [
        {
          id: "a1",
          userId: "u1",
          user: { id: "u1", name: "Alice", email: "a@x.com" },
          status: "ASSIGNED",
          clockedInAt: null,
          clockedOutAt: null,
        },
      ],
    });
    render(
      <ShiftCard
        shift={shift}
        canManage={true}
        isStaff={false}
        currentUserId={null}
        actions={actions}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /unassign alice/i }));
    expect(actions.onUnassign).toHaveBeenCalledWith("a1");
  });

  it("calls onEdit when Edit clicked", () => {
    const shift = createShift();
    render(
      <ShiftCard
        shift={shift}
        canManage={true}
        isStaff={false}
        currentUserId={null}
        actions={actions}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(actions.onEdit).toHaveBeenCalledWith(shift);
  });

  it("does not show manager actions when canManage is false", () => {
    const shift = createShift();
    render(
      <ShiftCard
        shift={shift}
        canManage={false}
        isStaff={false}
        currentUserId={null}
        actions={actions}
      />
    );
    expect(screen.queryByRole("button", { name: /publish/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /assign staff/i })).not.toBeInTheDocument();
  });

  it("shows Pick up button for staff when not assigned", () => {
    const shift = createShift({ isPublished: true });
    render(
      <ShiftCard
        shift={shift}
        canManage={false}
        isStaff={true}
        currentUserId="u2"
        actions={actions}
      />
    );
    expect(screen.getByRole("button", { name: /pick up/i })).toBeInTheDocument();
  });

  it("calls onPickup when Pick up clicked", () => {
    const shift = createShift({ isPublished: true });
    render(
      <ShiftCard
        shift={shift}
        canManage={false}
        isStaff={true}
        currentUserId="u2"
        actions={actions}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /pick up/i }));
    expect(actions.onPickup).toHaveBeenCalledWith(shift);
  });

  it("disables Pick up when shift is full", () => {
    const shift = createShift({
      isPublished: true,
      headcount: 1,
      assignments: [
        {
          id: "a1",
          userId: "u1",
          user: { id: "u1", name: "Alice", email: "a@x.com" },
          status: "ASSIGNED",
          clockedInAt: null,
          clockedOutAt: null,
        },
      ],
    });
    render(
      <ShiftCard
        shift={shift}
        canManage={false}
        isStaff={true}
        currentUserId="u2"
        actions={actions}
      />
    );
    expect(screen.getByRole("button", { name: /pick up/i })).toBeDisabled();
  });
});
