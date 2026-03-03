/**
 * Unit tests for StaffSelectModal component.
 */

import { render, screen, fireEvent, waitFor } from "@/components/features/__tests__/test-utils";
import { StaffSelectModal } from "../staff-select-modal";

describe("StaffSelectModal", () => {
  const mockFetch = jest.fn();
  const onOpenChange = jest.fn();
  const onAssignSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    onOpenChange.mockImplementation(() => {});
  });

  it("does not render content when closed", () => {
    render(
      <StaffSelectModal
        open={false}
        onOpenChange={onOpenChange}
        shiftId={null}
        shiftLocationId={null}
        requiredSkillIds={[]}
        requiredSkills={[]}
        onAssignSuccess={onAssignSuccess}
      />
    );
    expect(screen.queryByText("Assign staff")).not.toBeInTheDocument();
  });

  it("renders Assign staff title when open", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ staff: [] }),
    });

    render(
      <StaffSelectModal
        open={true}
        onOpenChange={onOpenChange}
        shiftId="shift1"
        shiftLocationId="loc1"
        requiredSkillIds={[]}
        requiredSkills={[]}
        onAssignSuccess={onAssignSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Assign staff")).toBeInTheDocument();
    });
  });

  it("shows Loading staff when fetching", async () => {
    let resolveFetch!: (value: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise<unknown>((r) => {
        resolveFetch = r;
      })
    );

    render(
      <StaffSelectModal
        open={true}
        onOpenChange={onOpenChange}
        shiftId="shift1"
        shiftLocationId="loc1"
        requiredSkillIds={[]}
        requiredSkills={[]}
        onAssignSuccess={onAssignSuccess}
      />
    );

    expect(screen.getByText("Loading staff...")).toBeInTheDocument();

    resolveFetch({ ok: true, json: async () => ({ staff: [] }) });
  });

  it("shows staff list when data loaded", async () => {
    mockFetch.mockResolvedValue({
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

    render(
      <StaffSelectModal
        open={true}
        onOpenChange={onOpenChange}
        shiftId="shift1"
        shiftLocationId="loc1"
        requiredSkillIds={["s1"]}
        requiredSkills={[{ id: "s1", name: "Bartender" }]}
        onAssignSuccess={onAssignSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("alice@x.com")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /assign/i })).toBeInTheDocument();
    });
  });

  it("shows No staff available when empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ staff: [] }),
    });

    render(
      <StaffSelectModal
        open={true}
        onOpenChange={onOpenChange}
        shiftId="shift1"
        shiftLocationId="loc1"
        requiredSkillIds={[]}
        requiredSkills={[]}
        onAssignSuccess={onAssignSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No staff available for this location.")).toBeInTheDocument();
    });
  });
});
