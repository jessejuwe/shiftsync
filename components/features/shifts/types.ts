export interface Shift {
  id: string;
  locationId: string;
  location: { id: string; name: string; timezone: string };
  startsAt: string;
  endsAt: string;
  title: string | null;
  notes: string | null;
  headcount?: number;
  isPublished: boolean;
  requiredSkills: { id: string; name: string }[];
  assignments: {
    id: string;
    userId: string;
    user: { id: string; name: string; email: string };
    status: string;
    clockedInAt: string | null;
    clockedOutAt: string | null;
  }[];
}

export interface Location {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
}
