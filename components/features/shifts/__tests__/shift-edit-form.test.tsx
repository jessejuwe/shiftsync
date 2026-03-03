/**
 * Unit tests for ShiftEditForm component.
 */

import { render, screen, fireEvent, waitFor } from "@/components/features/__tests__/test-utils";
import { ShiftEditForm } from "../shift-edit-form";

const shift = {
  id: "shift1",
  locationId: "loc1",
  startsAt: "2025-06-15T14:00:00.000Z",
  endsAt: "2025-06-15T22:00:00.000Z",
  title: "Evening shift",
  notes: "Busy night",
  headcount: 2,
  requiredSkills: [
    { id: "s1", name: "Bartender" },
    { id: "s2", name: "Server" },
  ],
};

const locations = [
  { id: "loc1", name: "Downtown Bar", address: null, timezone: "America/New_York" },
];
const skills = [
  { id: "s1", name: "Bartender", description: null },
  { id: "s2", name: "Server", description: null },
];

describe("ShiftEditForm", () => {
  const onSubmit = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
  });

  it("renders form with shift data", () => {
    render(
      <ShiftEditForm
        shift={shift}
        locations={locations}
        skills={skills}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Evening shift")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Busy night")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByText("Location cannot be changed when editing")).toBeInTheDocument();
  });

  it("shows error message when error prop", () => {
    render(
      <ShiftEditForm
        shift={shift}
        locations={locations}
        skills={skills}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
        error="Something went wrong"
      />
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows Saving... when isPending", () => {
    render(
      <ShiftEditForm
        shift={shift}
        locations={locations}
        skills={skills}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
        isPending={true}
      />
    );
    expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument();
  });

  it("calls onSubmit when form submitted", async () => {
    render(
      <ShiftEditForm
        shift={shift}
        locations={locations}
        skills={skills}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />
    );

    const startInput = screen.getByLabelText(/start time/i);
    fireEvent.change(startInput, { target: { value: "2025-06-15T15:00" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: "loc1",
          startsAt: expect.any(String),
          endsAt: expect.any(String),
        })
      );
    });
    expect(onSuccess).toHaveBeenCalled();
  });
});
