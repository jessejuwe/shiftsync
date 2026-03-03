/**
 * Unit tests for SchedulePublishBar component.
 */

import { render, screen, fireEvent } from "@/components/features/__tests__/test-utils";
import { SchedulePublishBar } from "../schedule-publish-bar";
import type { Shift } from "../types";

jest.mock("@/config/schedule", () => ({
  canUnpublishOrEdit: jest.fn(() => true),
  SCHEDULE_CONFIG: { unpublishEditCutoffHours: 48 },
}));

const createShift = (overrides: Partial<Shift> = {}): Shift => ({
  id: "s1",
  locationId: "loc1",
  location: { id: "loc1", name: "Downtown Bar", timezone: "America/New_York" },
  startsAt: "2025-06-15T14:00:00.000Z",
  endsAt: "2025-06-15T22:00:00.000Z",
  title: null,
  notes: null,
  isPublished: false,
  requiredSkills: [],
  assignments: [],
  ...overrides,
});

describe("SchedulePublishBar", () => {
  const onPublish = jest.fn();
  const onUnpublish = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders location name", () => {
    render(
      <SchedulePublishBar
        shiftsByLocation={[
          {
            location: { id: "loc1", name: "Downtown Bar" },
            shifts: [createShift()],
          },
        ]}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        isPublishPending={false}
        isUnpublishPending={false}
      />
    );
    expect(screen.getByText("Downtown Bar")).toBeInTheDocument();
  });

  it("shows Publish button when there are unpublished shifts", () => {
    render(
      <SchedulePublishBar
        shiftsByLocation={[
          {
            location: { id: "loc1", name: "Downtown Bar" },
            shifts: [createShift({ isPublished: false })],
          },
        ]}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        isPublishPending={false}
        isUnpublishPending={false}
      />
    );
    const publishBtn = screen.getByRole("button", { name: /publish/i });
    expect(publishBtn).toBeInTheDocument();
    fireEvent.click(publishBtn);
    expect(onPublish).toHaveBeenCalledWith("loc1", ["s1"]);
  });

  it("shows Publish (n) when some shifts are published", () => {
    render(
      <SchedulePublishBar
        shiftsByLocation={[
          {
            location: { id: "loc1", name: "Downtown Bar" },
            shifts: [
              createShift({ id: "s1", isPublished: false }),
              createShift({ id: "s2", isPublished: true }),
            ],
          },
        ]}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        isPublishPending={false}
        isUnpublishPending={false}
      />
    );
    expect(screen.getByRole("button", { name: /publish \(1\)/i })).toBeInTheDocument();
  });

  it("shows Unpublish button when there are published shifts", () => {
    render(
      <SchedulePublishBar
        shiftsByLocation={[
          {
            location: { id: "loc1", name: "Downtown Bar" },
            shifts: [createShift({ id: "s1", isPublished: true })],
          },
        ]}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        isPublishPending={false}
        isUnpublishPending={false}
      />
    );
    const unpublishBtn = screen.getByRole("button", { name: /unpublish/i });
    fireEvent.click(unpublishBtn);
    expect(onUnpublish).toHaveBeenCalledWith("loc1", ["s1"]);
  });

  it("disables Publish when isPublishPending", () => {
    render(
      <SchedulePublishBar
        shiftsByLocation={[
          {
            location: { id: "loc1", name: "Downtown Bar" },
            shifts: [createShift({ isPublished: false })],
          },
        ]}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        isPublishPending={true}
        isUnpublishPending={false}
      />
    );
    expect(screen.getByRole("button", { name: /publish/i })).toBeDisabled();
  });
});
