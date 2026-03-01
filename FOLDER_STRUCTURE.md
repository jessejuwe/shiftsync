# ShiftSync – Folder Structure

A clean fullstack Next.js monorepo structure for shift scheduling and management.

```
shiftsync/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── shifts/
│   │   ├── staff/
│   │   ├── locations/
│   │   ├── availability/
│   │   └── settings/
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   ├── shifts/
│   │   ├── staff/
│   │   ├── locations/
│   │   ├── availability/
│   │   ├── swap-requests/
│   │   └── notifications/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── forms/                    # Form components (react-hook-form + zod)
│   ├── layout/                   # Header, Sidebar, etc.
│   └── features/                 # Feature-specific components
│       ├── shifts/
│       ├── staff/
│       └── availability/
│
├── lib/
│   ├── prisma.ts                 # Prisma client singleton
│   ├── pusher.ts                 # Pusher client/server config
│   ├── axios.ts                  # Axios instance with interceptors
│   ├── utils.ts                  # cn(), formatDate, etc.
│   └── validations/              # Zod schemas
│       ├── auth.ts
│       ├── shift.ts
│       ├── staff.ts
│       └── availability.ts
│
├── hooks/
│   ├── use-shifts.ts
│   ├── use-staff.ts
│   ├── use-availability.ts
│   └── use-notifications.ts
│
├── stores/                       # Zustand stores
│   ├── auth-store.ts
│   ├── ui-store.ts
│   └── notification-store.ts
│
├── types/
│   ├── index.ts                  # Re-exports
│   ├── api.ts                    # API response types
│   └── database.ts               # Prisma-generated types (extended)
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
├── config/
│   └── env.ts                    # Validated env vars
│
└── public/
```

## Key Conventions

- **Timestamps**: All stored in UTC in the database; convert to location timezone for display.
- **Overnight shifts**: Modeled with `startsAt` and `endsAt` in UTC; `endsAt` is always chronologically after `startsAt` (e.g. 22:00 → 06:00 next day).
- **Path alias**: `@/` maps to project root for imports.
