# ShiftSync

Shift scheduling and management for multi-location teams. Next.js fullstack app with real-time updates.

## Getting Started

```bash
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Login Credentials (seed)

| Role  | Email                   | Password      |
| ----- | ----------------------- | ------------- |
| Admin | `admin@shiftsync.local` | `password123` |

All seeded users share `password123`.

---

## Project Structure

```
shiftsync/
├── app/
│   ├── (auth)/                   # Login, register
│   ├── (dashboard)/              # Protected routes (dashboard, shifts, audit)
│   └── api/                      # REST API (shifts, staff, locations, overtime, fairness, audit, etc.)
├── components/
│   ├── ui/                       # shadcn/ui
│   └── features/                 # shifts, overtime, fairness, audit
├── lib/
│   ├── auth.ts                   # NextAuth
│   ├── domain/                   # Pure domain logic (fairness, overtime, shift-policy)
│   └── validations/              # Zod schemas
├── hooks/                        # use-shifts, use-realtime-schedule, etc.
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── config/
```

**Conventions:** Timestamps in UTC; overnight shifts use `startsAt`/`endsAt` (e.g. 22:00 → 06:00 next day); `@/` path alias.

---

## Golden Rules

1. **Fail loudly** – Validation returns typed codes and clear messages; never silent failures.
2. **Transactional** – Every state change runs inside `prisma.$transaction`.
3. **Logic outside routes** – Business logic in `lib/domain/`; routes orchestrate only.
4. **UTC timestamps** – All stored in UTC; convert to location timezone for display.
5. **Validate inside transaction** – Validation after lock/fresh read, not before.

---

## Winning Scenarios

| Scenario | What to show |
|----------|--------------|
| **Simultaneous Assignment** | One succeeds; one gets 409 conflict; staff gets real-time conflict notification (Pusher) |
| **Overtime Trap** | Real-time projected hours; highlighted staff (amber/red); what-if preview before assign |
| **Fairness Complaint** | Premium shift chart; hours delta (+/−); equity score; over/under badges |

---

## Architecture

- **Next.js App Router** – Server components where possible; client for interactivity.
- **Prisma + PostgreSQL** – ORM with migrations.
- **NextAuth** – Credentials provider; session-based auth.
- **Pusher** – Real-time schedule events (shift assigned, edited, published).
- **Domain logic in `lib/domain/`** – Pure functions for fairness, overtime, shift-policy; no DB calls; testable.

---

## Assumptions

- Week = Monday–Sunday (ISO).
- Overtime: 40h warning, 48h block; max 12h/day, 6 consecutive days.
- Premium shifts: Fri/Sat evening (location timezone).
- Fairness: target 40h/week; equity score from hours + premium distribution.
- Locations have IANA timezones; shifts stored in UTC.

---

## Known Limitations

- No user registration UI (seed only).
- Audit trail: admin-only; no retention policy.
- Consecutive-day calculation uses last 14 days of assignments.
- Pusher required for real-time; falls back to manual refresh if unconfigured.

---

## Intentional Ambiguities — Design Decisions

This section documents how ShiftSync handles ambiguities that were left unspecified in the evaluation criteria.

### 1. Historical data when a staff member is de-certified from a location

**Decision:** Historical data is preserved. De-certification only affects future assignments.

**Rationale:** Past shifts and assignments are historical records; altering or cascading deletes would corrupt audit trails and reporting. Certification is enforced only at assignment time.

**Implementation:** `ShiftAssignment` has no FK to `Certification`; certification checks use `expiresAt > now` for new assignments only; deleting/expiring a cert does not touch existing assignments.

### 2. How "desired hours" interacts with availability windows

**Decision:** They are independent. No interaction.

**Rationale:** Desired hours are a fairness target (e.g. 40h/week); availability defines when staff can work. Combining them would require per-user desired hours and complex logic. Keeping them separate keeps the model simple and predictable.

**Implementation:** Desired hours used only in fairness analytics (`targetHoursPerPeriod`, `desiredHoursDelta`, `equityScore`); availability used only in assignment validation (`checkAvailability`); no shared logic or data flow.

### 3. Consecutive days: does a 1-hour shift count the same as an 11-hour shift?

**Decision:** Yes. Any shift on a calendar day counts as one working day, regardless of duration.

**Rationale:** The policy is "consecutive working days," not "consecutive hours." A 1-hour shift still requires the employee to work that day. Counting by calendar day is simple and aligns with common labor rules.

**Implementation:** Consecutive days computed from unique calendar dates (`startsAt`/`endsAt` via `toDateKey`); overnight shifts contribute to both start and end dates; duration is not used.

### 4. Shift edited after swap approval but before it occurs

**Decision:** Edits after approval do not affect the swap. Only in-progress swaps are cancelled when a shift is edited.

**Rationale:** Once a swap is approved, assignments are already swapped—the swap is complete. Editing the shift only updates the shift; it does not revalidate or undo the swap. Cancelling would require reverting assignments and would be confusing for staff.

**Implementation:** `PATCH /api/shifts/[id]` only cancels swaps with `status: "PENDING"` (REQUESTED, ACCEPTED, PENDING_MANAGER); APPROVED swaps are not queried or modified; `SHIFT_EDITED` transitions pending swaps to CANCELLED and notifies both parties.

### 5. Location that spans a timezone boundary

**Decision:** Not supported. Each location has a single IANA timezone.

**Rationale:** Supporting multiple timezones per location would complicate premium shift detection, availability, and display. Most real-world locations fit a single timezone; edge cases can be modeled as separate locations.

**Implementation:** `Location` has one `timezone` field (e.g. `"America/New_York"`); premium shift detection uses that timezone; for locations spanning boundaries, choose one timezone or split into multiple locations.

### Summary Table

| Ambiguity | Decision |
|-----------|----------|
| Historical data when de-certified | Preserved; only future assignments require valid cert |
| Desired hours vs availability | Independent; no interaction |
| 1h vs 11h for consecutive days | Both count as one working day |
| Shift edited after swap approval | Swap remains; only pending swaps cancelled on edit |
| Location spans timezone boundary | Not supported; one timezone per location |

---

## Concurrency

- **Shift assignment:** `SELECT ... FOR UPDATE` on the user row before creating the assignment, inside a Prisma transaction. Prevents double-booking and race conditions when multiple managers assign the same user.
- **Swap requests:** Status transitions validated in domain logic; DB constraints enforce uniqueness.
- **Real-time:** Pusher broadcasts; clients invalidate/refetch React Query on events.
