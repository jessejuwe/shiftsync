/**
 * Unit tests for StaffCard component.
 */

import { render, screen, fireEvent } from "@/components/features/__tests__/test-utils";
import { StaffCard, type StaffMember, type Skill, type Location } from "../staff-card";

const defaultStaff: StaffMember = {
  id: "u1",
  name: "Alice Smith",
  email: "alice@example.com",
  role: "STAFF",
  skills: [{ id: "s1", name: "Bartender" }],
  certifications: [
    {
      id: "c1",
      locationId: "loc1",
      locationName: "Downtown Bar",
      expiresAt: "2030-01-01T00:00:00.000Z",
    },
  ],
};

const defaultSkills: Skill[] = [
  { id: "s1", name: "Bartender", description: null },
  { id: "s2", name: "Server", description: null },
];

const defaultLocations: Location[] = [
  { id: "loc1", name: "Downtown Bar" },
  { id: "loc2", name: "Airport Lounge" },
];

const defaultHandlers = {
  onAddSkill: jest.fn(),
  onRemoveSkill: jest.fn(),
  onCertify: jest.fn(),
  onDecertify: jest.fn(),
};

function renderStaffCard(overrides: Partial<Parameters<typeof StaffCard>[0]> = {}) {
  return render(
    <StaffCard
      staff={defaultStaff}
      skills={defaultSkills}
      locations={defaultLocations}
      onAddSkill={defaultHandlers.onAddSkill}
      onRemoveSkill={defaultHandlers.onRemoveSkill}
      onCertify={defaultHandlers.onCertify}
      onDecertify={defaultHandlers.onDecertify}
      isAddingSkill={false}
      isRemovingSkill={false}
      isCertifying={false}
      isDecertifying={false}
      {...overrides}
    />
  );
}

describe("StaffCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders staff name and email", () => {
    renderStaffCard();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("shows Manager badge when role is MANAGER", () => {
    renderStaffCard({
      staff: { ...defaultStaff, role: "MANAGER" },
    });
    expect(screen.getByText("Manager")).toBeInTheDocument();
  });

  it("does not show Manager badge when role is STAFF", () => {
    renderStaffCard();
    expect(screen.queryByText("Manager")).not.toBeInTheDocument();
  });

  it("renders skill badges", () => {
    renderStaffCard();
    expect(screen.getByText("Bartender")).toBeInTheDocument();
  });

  it("calls onRemoveSkill when remove skill button clicked", () => {
    renderStaffCard();
    const removeBtn = screen.getByRole("button", { name: /remove bartender/i });
    fireEvent.click(removeBtn);
    expect(defaultHandlers.onRemoveSkill).toHaveBeenCalledWith("s1");
  });

  it("renders certification badges", () => {
    renderStaffCard();
    expect(screen.getByText("Downtown Bar")).toBeInTheDocument();
  });

  it("calls onDecertify when de-certify button clicked", () => {
    renderStaffCard();
    const decertifyBtn = screen.getByRole("button", {
      name: /de-certify from downtown bar/i,
    });
    fireEvent.click(decertifyBtn);
    expect(defaultHandlers.onDecertify).toHaveBeenCalledWith("c1");
  });

  it("shows expired label for expired certifications", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-06-01"));
    renderStaffCard({
      staff: {
        ...defaultStaff,
        certifications: [
          {
            id: "c1",
            locationId: "loc1",
            locationName: "Downtown Bar",
            expiresAt: "2025-01-01T00:00:00.000Z",
          },
        ],
      },
    });
    expect(screen.getByText(/\(expired\)/)).toBeInTheDocument();
    jest.useRealTimers();
  });

  it("shows empty state when no skills or certifications", () => {
    renderStaffCard({
      staff: {
        ...defaultStaff,
        skills: [],
        certifications: [],
      },
      skills: [],
      locations: [],
    });
    expect(
      screen.getByText(/No skills or certifications. Add skills and certify at locations./)
    ).toBeInTheDocument();
  });

  it("disables remove skill button when isRemovingSkill is true", () => {
    renderStaffCard({ isRemovingSkill: true });
    const removeBtn = screen.getByRole("button", { name: /remove bartender/i });
    expect(removeBtn).toBeDisabled();
  });
});
