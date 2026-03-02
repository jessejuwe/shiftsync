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

## Concurrency

- **Shift assignment:** `SELECT ... FOR UPDATE` on the user row before creating the assignment, inside a Prisma transaction. Prevents double-booking and race conditions when multiple managers assign the same user.
- **Swap requests:** Status transitions validated in domain logic; DB constraints enforce uniqueness.
- **Real-time:** Pusher broadcasts; clients invalidate/refetch React Query on events.
