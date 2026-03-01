import bcrypt from "bcryptjs";
import { addDays, subMonths } from "date-fns";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

/** Default password for all seeded users */
const PASSWORD = "password123";

/** Get Monday 00:00 UTC of current week (seed targets "this week") */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setUTCDate(diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

async function main() {
  // Clean slate: delete seed data so we can recreate with fixed IDs
  await prisma.$transaction([
    prisma.auditLog.deleteMany({}),
    prisma.notification.deleteMany({}),
    prisma.swapRequest.deleteMany({}),
    prisma.shiftAssignment.deleteMany({}),
    prisma.shiftSkill.deleteMany({}),
    prisma.shift.deleteMany({}),
    prisma.availabilityWindow.deleteMany({}),
    prisma.certification.deleteMany({}),
    prisma.staffSkill.deleteMany({}),
    prisma.account.deleteMany({}),
    prisma.session.deleteMany({}),
    prisma.user.deleteMany({}),
    prisma.skill.deleteMany({}),
    prisma.location.deleteMany({}),
  ]);
  console.log("Cleared previous seed data");

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const weekStart = getWeekStart();
  const mon = weekStart;
  const tue = addDays(mon, 1);
  const wed = addDays(mon, 2);
  const thu = addDays(mon, 3);
  const fri = addDays(mon, 4);
  const sat = addDays(mon, 5);
  const sun = addDays(mon, 6);

  console.log("Seeding for week starting: ", mon.toISOString());

  // ==========================================================================
  // LOCATIONS (4 locations, 2 time zones)
  // ==========================================================================
  const locEast1 = await prisma.location.upsert({
    where: { id: "loc-east-downtown" },
    update: {},
    create: {
      id: "loc-east-downtown",
      name: "Downtown Manhattan",
      address: "350 5th Ave, New York, NY",
      timezone: "America/New_York",
    },
  });
  const locEast2 = await prisma.location.upsert({
    where: { id: "loc-east-brooklyn" },
    update: {},
    create: {
      id: "loc-east-brooklyn",
      name: "Brooklyn Heights",
      address: "100 Henry St, Brooklyn, NY",
      timezone: "America/New_York",
    },
  });
  const locWest1 = await prisma.location.upsert({
    where: { id: "loc-west-sf" },
    update: {},
    create: {
      id: "loc-west-sf",
      name: "SF Union Square",
      address: "333 Post St, San Francisco, CA",
      timezone: "America/Los_Angeles",
    },
  });
  const locWest2 = await prisma.location.upsert({
    where: { id: "loc-west-oakland" },
    update: {},
    create: {
      id: "loc-west-oakland",
      name: "Oakland Jack London",
      address: "55 Harrison St, Oakland, CA",
      timezone: "America/Los_Angeles",
    },
  });
  console.log("Created 4 locations (2 ET, 2 PT)");

  // ==========================================================================
  // SKILLS
  // ==========================================================================
  const skills = await Promise.all(
    [
      { id: "skill-bar", name: "Bar" },
      { id: "skill-kitchen", name: "Kitchen" },
      { id: "skill-host", name: "Host" },
      { id: "skill-server", name: "Server" },
      { id: "skill-sommelier", name: "Sommelier" },
      { id: "skill-prep", name: "Prep" },
      { id: "skill-manager", name: "Manager" },
    ].map((s) =>
      prisma.skill.upsert({
        where: { id: s.id },
        update: {},
        create: s,
      }),
    ),
  );
  const skillMap = Object.fromEntries(skills.map((s) => [s.name, s.id]));
  console.log("Created 7 skills");

  // ==========================================================================
  // USERS (25 staff: 1 admin, 2 managers, 22 staff)
  // ==========================================================================
  const usersData = [
    {
      id: "user-admin",
      name: "Alex Chen",
      email: "admin@shiftsync.local",
      role: "ADMIN" as const,
    },
    {
      id: "user-mgr-ny",
      name: "Jordan Rivera",
      email: "jordan.rivera@shiftsync.local",
      role: "MANAGER" as const,
    },
    {
      id: "user-mgr-sf",
      name: "Sam Foster",
      email: "sam.foster@shiftsync.local",
      role: "MANAGER" as const,
    },
    {
      id: "user-01",
      name: "Morgan Taylor",
      email: "morgan.taylor@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-02",
      name: "Riley Kim",
      email: "riley.kim@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-03",
      name: "Casey Nguyen",
      email: "casey.nguyen@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-04",
      name: "Jamie Patel",
      email: "jamie.patel@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-05",
      name: "Drew Martinez",
      email: "drew.martinez@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-06",
      name: "Quinn O'Brien",
      email: "quinn.obrien@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-07",
      name: "Avery Johnson",
      email: "avery.johnson@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-08",
      name: "Skyler Wu",
      email: "skyler.wu@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-09",
      name: "Parker Davis",
      email: "parker.davis@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-10",
      name: "Blake Thompson",
      email: "blake.thompson@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-11",
      name: "Cameron Lee",
      email: "cameron.lee@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-12",
      name: "Reese Brown",
      email: "reese.brown@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-13",
      name: "Finley Wilson",
      email: "finley.wilson@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-14",
      name: "Emery Garcia",
      email: "emery.garcia@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-15",
      name: "Hayden Miller",
      email: "hayden.miller@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-16",
      name: "Sage Anderson",
      email: "sage.anderson@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-17",
      name: "River Clark",
      email: "river.clark@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-18",
      name: "Phoenix White",
      email: "phoenix.white@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-19",
      name: "Rowan Hall",
      email: "rowan.hall@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-20",
      name: "Dakota Young",
      email: "dakota.young@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-21",
      name: "Emerson King",
      email: "emerson.king@shiftsync.local",
      role: "STAFF" as const,
    },
    {
      id: "user-22",
      name: "Harper Scott",
      email: "harper.scott@shiftsync.local",
      role: "STAFF" as const,
    },
  ];

  const users = await Promise.all(
    usersData.map((u) =>
      prisma.user.create({
        data: {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          passwordHash,
        },
      }),
    ),
  );
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  console.log("Created 25 users");

  // ==========================================================================
  // STAFF SKILLS (mixed - bar, kitchen, server, host, sommelier, prep)
  // ==========================================================================
  const staffSkills: [string, string[]][] = [
    ["user-mgr-ny", ["Bar", "Manager"]],
    ["user-mgr-sf", ["Kitchen", "Manager"]],
    ["user-01", ["Bar", "Server"]],
    ["user-02", ["Kitchen", "Prep"]],
    ["user-03", ["Server", "Host"]],
    ["user-04", ["Bar", "Sommelier"]], // Cross-skilled
    ["user-05", ["Kitchen", "Prep"]],
    ["user-06", ["Server", "Host"]],
    ["user-07", ["Bar", "Server"]],
    ["user-08", ["Kitchen"]],
    ["user-09", ["Server", "Sommelier"]], // Cross-skilled
    ["user-10", ["Bar", "Prep"]],
    ["user-11", ["Host", "Server"]],
    ["user-12", ["Kitchen", "Prep"]],
    ["user-13", ["Bar", "Server"]],
    ["user-14", ["Server", "Sommelier"]],
    ["user-15", ["Kitchen", "Prep"]],
    ["user-16", ["Bar", "Host"]],
    ["user-17", ["Server"]],
    ["user-18", ["Kitchen", "Bar"]], // Cross-skilled
    ["user-19", ["Host", "Prep"]],
    ["user-20", ["Server", "Bar"]],
    ["user-21", ["Kitchen"]],
    ["user-22", ["Server", "Host"]],
  ];

  for (const [userId, skillNames] of staffSkills) {
    for (const name of skillNames) {
      const skillId = skillMap[name];
      if (skillId) {
        await prisma.staffSkill.upsert({
          where: {
            userId_skillId: { userId, skillId },
          },
          update: {},
          create: { userId, skillId, level: 3 + Math.floor(Math.random() * 2) },
        });
      }
    }
  }
  console.log("Assigned mixed skills");

  // ==========================================================================
  // CERTIFICATIONS (cross-certified + one expiring soon)
  // ==========================================================================
  const now = new Date();
  const expiringSoon = addDays(now, 5); // Expires in 5 days
  const validFuture = addMonths(now, 12);

  // Cross-certified: Morgan (user-01), Casey (user-03), Jamie (user-04) - certs at 2+ locations
  await prisma.certification.upsert({
    where: { id: "cert-morgan-ny" },
    update: {},
    create: {
      id: "cert-morgan-ny",
      userId: "user-01",
      locationId: locEast1.id,
      name: "Food Handler",
      issuedAt: subMonths(now, 6),
      expiresAt: validFuture,
    },
  });
  await prisma.certification.upsert({
    where: { id: "cert-morgan-bk" },
    update: {},
    create: {
      id: "cert-morgan-bk",
      userId: "user-01",
      locationId: locEast2.id,
      name: "Food Handler",
      issuedAt: subMonths(now, 6),
      expiresAt: validFuture,
    },
  });
  await prisma.certification.upsert({
    where: { id: "cert-casey-ny" },
    update: {},
    create: {
      id: "cert-casey-ny",
      userId: "user-03",
      locationId: locEast1.id,
      name: "TIPS Alcohol",
      issuedAt: subMonths(now, 3),
      expiresAt: validFuture,
    },
  });
  await prisma.certification.upsert({
    where: { id: "cert-casey-sf" },
    update: {},
    create: {
      id: "cert-casey-sf",
      userId: "user-03",
      locationId: locWest1.id,
      name: "TIPS Alcohol",
      issuedAt: subMonths(now, 3),
      expiresAt: validFuture,
    },
  });
  await prisma.certification.upsert({
    where: { id: "cert-jamie-ny" },
    update: {},
    create: {
      id: "cert-jamie-ny",
      userId: "user-04",
      locationId: locEast1.id,
      name: "CPR",
      issuedAt: subMonths(now, 11),
      expiresAt: validFuture,
    },
  });
  await prisma.certification.upsert({
    where: { id: "cert-jamie-oak" },
    update: {},
    create: {
      id: "cert-jamie-oak",
      userId: "user-04",
      locationId: locWest2.id,
      name: "CPR",
      issuedAt: subMonths(now, 11),
      expiresAt: validFuture,
    },
  });

  // ONE EXPIRING CERT: Drew Martinez - CPR expires in 5 days
  await prisma.certification.upsert({
    where: { id: "cert-drew-expiring" },
    update: {},
    create: {
      id: "cert-drew-expiring",
      userId: "user-05",
      locationId: locEast1.id,
      name: "CPR",
      issuedAt: subMonths(now, 12),
      expiresAt: expiringSoon,
    },
  });

  // More certs for variety
  await prisma.certification.upsert({
    where: { id: "cert-riley-ny" },
    update: {},
    create: {
      id: "cert-riley-ny",
      userId: "user-02",
      locationId: locEast1.id,
      name: "Food Handler",
      issuedAt: subMonths(now, 2),
      expiresAt: validFuture,
    },
  });
  console.log("Created certifications (cross-certified + 1 expiring)");

  // ==========================================================================
  // SHIFTS (this week, spread across locations)
  // All times UTC. 8h shifts = 09:00-17:00, evening = 17:00-01:00, etc.
  // ==========================================================================
  function shiftTime(
    d: Date,
    startH: number,
    startM: number,
    endH: number,
    endM: number,
  ) {
    const s = new Date(d);
    s.setUTCHours(startH, startM, 0, 0);
    let e = new Date(d);
    if (endH < startH) e = addDays(e, 1);
    e.setUTCHours(endH, endM, 0, 0);
    return { startsAt: s, endsAt: e };
  }

  const shifts: {
    id: string;
    locationId: string;
    startsAt: Date;
    endsAt: Date;
    title?: string;
  }[] = [];

  // Downtown Manhattan - Mon-Sun
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    shifts.push({
      id: `shift-dt-mon-${i}`,
      locationId: locEast1.id,
      ...shiftTime(d, 9, 0, 17, 0),
      title: "Day shift",
    });
    shifts.push({
      id: `shift-dt-eve-${i}`,
      locationId: locEast1.id,
      ...shiftTime(d, 17, 0, 1, 0),
      title: "Evening shift",
    });
  }
  // Brooklyn - Fri-Sun (busy weekend)
  for (let i = 4; i < 7; i++) {
    const d = addDays(mon, i);
    shifts.push({
      id: `shift-bk-${i}`,
      locationId: locEast2.id,
      ...shiftTime(d, 17, 0, 1, 0),
      title: "Evening",
    });
  }
  // SF - Tue-Sat
  for (let i = 1; i < 6; i++) {
    const d = addDays(mon, i);
    shifts.push({
      id: `shift-sf-${i}`,
      locationId: locWest1.id,
      ...shiftTime(d, 10, 0, 18, 0),
      title: "Day",
    });
  }
  // Oakland - Thu-Sun
  for (let i = 3; i < 7; i++) {
    const d = addDays(mon, i);
    shifts.push({
      id: `shift-oak-${i}`,
      locationId: locWest2.id,
      ...shiftTime(d, 18, 0, 2, 0),
      title: "Night",
    });
  }

  for (const s of shifts) {
    await prisma.shift.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        locationId: s.locationId,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        title: s.title,
        isPublished: true,
      },
    });
  }
  console.log("Created shifts");

  // Add required skills to some shifts (Bar required for evening, etc.)
  const barSkill = skillMap["Bar"];
  const serverSkill = skillMap["Server"];
  const kitchenSkill = skillMap["Kitchen"];
  for (const s of shifts) {
    if (s.title?.includes("Evening") || s.title === "Night") {
      await prisma.shiftSkill.upsert({
        where: { shiftId_skillId: { shiftId: s.id, skillId: barSkill } },
        update: {},
        create: { shiftId: s.id, skillId: barSkill },
      });
    }
    if (s.title === "Day shift" || s.title === "Day") {
      await prisma.shiftSkill.upsert({
        where: { shiftId_skillId: { shiftId: s.id, skillId: serverSkill } },
        update: {},
        create: { shiftId: s.id, skillId: serverSkill },
      });
    }
  }

  // ==========================================================================
  // ASSIGNMENTS - Scenario-driven
  // ==========================================================================
  // user-01 Morgan: NEAR 39 HOURS (Mon 8h + Tue 8h + Wed 8h + Thu 7h + Fri 8h = 39)
  // 5th shift for Morgan: Thu 9:00-16:00 UTC = 7h → total 39h
  const thu9 = addDays(mon, 3);
  const shortStarts = new Date(thu9);
  shortStarts.setUTCHours(9, 0, 0, 0);
  const shortEnds = new Date(thu9);
  shortEnds.setUTCHours(16, 0, 0, 0);
  const shortShift = await prisma.shift.upsert({
    where: { id: "shift-dt-short-39" },
    update: {},
    create: {
      id: "shift-dt-short-39",
      locationId: locEast1.id,
      startsAt: shortStarts,
      endsAt: shortEnds,
      title: "Short shift",
      isPublished: true,
    },
  });
  shifts.push({
    id: shortShift.id,
    locationId: shortShift.locationId,
    startsAt: shortShift.startsAt,
    endsAt: shortShift.endsAt,
    title: shortShift.title ?? undefined,
  });

  // Morgan: Mon day, Tue day, Wed day, Thu short, Fri day = 39h
  const m1 = await prisma.shiftAssignment.upsert({
    where: { shiftId_userId: { shiftId: "shift-dt-mon-0", userId: "user-01" } },
    update: {},
    create: {
      shiftId: "shift-dt-mon-0",
      userId: "user-01",
      status: "confirmed",
    },
  });
  await prisma.shiftAssignment.upsert({
    where: { shiftId_userId: { shiftId: "shift-dt-mon-1", userId: "user-01" } },
    update: {},
    create: {
      shiftId: "shift-dt-mon-1",
      userId: "user-01",
      status: "confirmed",
    },
  });
  await prisma.shiftAssignment.upsert({
    where: { shiftId_userId: { shiftId: "shift-dt-mon-2", userId: "user-01" } },
    update: {},
    create: {
      shiftId: "shift-dt-mon-2",
      userId: "user-01",
      status: "confirmed",
    },
  });
  await prisma.shiftAssignment.upsert({
    where: {
      shiftId_userId: { shiftId: "shift-dt-short-39", userId: "user-01" },
    },
    update: {},
    create: {
      shiftId: "shift-dt-short-39",
      userId: "user-01",
      status: "confirmed",
    },
  });
  await prisma.shiftAssignment.upsert({
    where: { shiftId_userId: { shiftId: "shift-dt-mon-4", userId: "user-01" } },
    update: {},
    create: {
      shiftId: "shift-dt-mon-4",
      userId: "user-01",
      status: "confirmed",
    },
  });

  // user-02 Riley: 5 CONSECUTIVE DAYS (Mon-Fri)
  for (let i = 0; i < 5; i++) {
    await prisma.shiftAssignment.upsert({
      where: {
        shiftId_userId: {
          shiftId: `shift-dt-mon-${i}`,
          userId: "user-02",
        },
      },
      update: {},
      create: {
        shiftId: `shift-dt-mon-${i}`,
        userId: "user-02",
        status: "confirmed",
      },
    });
  }

  // user-03 Casey: FAIRNESS IMBALANCE - many Saturday nights (premium shifts)
  // Fri eve + Sat eve + Sat night = 3 premium shifts this week
  await prisma.shiftAssignment.upsert({
    where: { shiftId_userId: { shiftId: "shift-dt-eve-4", userId: "user-03" } },
    update: {},
    create: {
      shiftId: "shift-dt-eve-4",
      userId: "user-03",
      status: "confirmed",
    },
  });
  await prisma.shiftAssignment.upsert({
    where: { shiftId_userId: { shiftId: "shift-dt-eve-5", userId: "user-03" } },
    update: {},
    create: {
      shiftId: "shift-dt-eve-5",
      userId: "user-03",
      status: "confirmed",
    },
  });
  await prisma.shiftAssignment.upsert({
    where: { shiftId_userId: { shiftId: "shift-bk-5", userId: "user-03" } },
    update: {},
    create: { shiftId: "shift-bk-5", userId: "user-03", status: "confirmed" },
  });
  await prisma.shiftAssignment.upsert({
    where: { shiftId_userId: { shiftId: "shift-bk-6", userId: "user-03" } },
    update: {},
    create: { shiftId: "shift-bk-6", userId: "user-03", status: "confirmed" },
  });
  // Casey: Wed day, Thu day + Fri/Sat/Sun premium = fairness imbalance (4 premium shifts)
  await prisma.shiftAssignment.upsert({
    where: { shiftId_userId: { shiftId: "shift-dt-mon-2", userId: "user-03" } },
    update: {},
    create: {
      shiftId: "shift-dt-mon-2",
      userId: "user-03",
      status: "confirmed",
    },
  });
  await prisma.shiftAssignment.upsert({
    where: { shiftId_userId: { shiftId: "shift-dt-mon-3", userId: "user-03" } },
    update: {},
    create: {
      shiftId: "shift-dt-mon-3",
      userId: "user-03",
      status: "confirmed",
    },
  });

  // Fill remaining shifts with other staff (so schedule looks full)
  const staffIds = usersData.filter((u) => u.role === "STAFF").map((u) => u.id);
  const assignedShiftIds = new Set([
    "shift-dt-mon-0",
    "shift-dt-mon-1",
    "shift-dt-mon-2",
    "shift-dt-mon-3",
    "shift-dt-mon-4",
    "shift-dt-short-39",
    "shift-bk-4",
    "shift-bk-5",
    "shift-bk-6",
    "shift-dt-eve-4",
    "shift-dt-eve-5",
  ]);
  const unassignedShifts = shifts.filter((s) => !assignedShiftIds.has(s.id));
  for (let i = 0; i < Math.min(unassignedShifts.length, 30); i++) {
    const s = unassignedShifts[i];
    const uid = staffIds[(i + 10) % staffIds.length];
    await prisma.shiftAssignment.upsert({
      where: { shiftId_userId: { shiftId: s.id, userId: uid } },
      update: {},
      create: { shiftId: s.id, userId: uid, status: "confirmed" },
    });
  }

  // ==========================================================================
  // ONE PENDING SWAP
  // SwapRequest needs initiatorShiftId and receiverShiftId = ShiftAssignment IDs
  // ==========================================================================
  const initiatorAssignment = await prisma.shiftAssignment.findFirst({
    where: { userId: "user-06", shift: { locationId: locEast1.id } },
    include: { shift: true },
  });
  const receiverAssignment = await prisma.shiftAssignment.findFirst({
    where: {
      userId: "user-07",
      shift: { locationId: locEast1.id },
      id: { not: initiatorAssignment?.id },
    },
    include: { shift: true },
  });

  if (initiatorAssignment && receiverAssignment) {
    await prisma.swapRequest.upsert({
      where: { id: "swap-pending-01" },
      update: {},
      create: {
        id: "swap-pending-01",
        initiatorId: "user-06",
        receiverId: "user-07",
        initiatorShiftId: initiatorAssignment.id,
        receiverShiftId: receiverAssignment.id,
        status: "PENDING",
        message: "Family event on Saturday - can we swap?",
      },
    });
    console.log("Created pending swap request");
  }

  // ==========================================================================
  // ONE EXPIRING CERT NOTIFICATION (drop = certification expiring)
  // ==========================================================================
  await prisma.notification.upsert({
    where: { id: "notif-expiring-cert" },
    update: {},
    create: {
      id: "notif-expiring-cert",
      userId: "user-05",
      type: "SYSTEM",
      title: "Certification expiring soon",
      body: "Your CPR certification at Downtown Manhattan expires in 5 days. Please renew to maintain your schedule.",
      data: {
        certificationId: "cert-drew-expiring",
        expiresAt: expiringSoon.toISOString(),
      },
    },
  });
  console.log("Created expiring cert notification");

  // ==========================================================================
  // AVAILABILITY (a few staff with recurring availability)
  // ==========================================================================
  const baseAvail = new Date(mon);
  baseAvail.setUTCHours(0, 0, 0, 0);
  const availWindows = [
    {
      userId: "user-01",
      locationId: locEast1.id,
      dayOfWeek: 1,
      startH: 9,
      startM: 0,
      endH: 22,
      endM: 0,
    },
    {
      userId: "user-01",
      locationId: locEast1.id,
      dayOfWeek: 2,
      startH: 9,
      startM: 0,
      endH: 22,
      endM: 0,
    },
    {
      userId: "user-03",
      locationId: locEast1.id,
      dayOfWeek: 5,
      startH: 17,
      startM: 0,
      endH: 1,
      endM: 0,
    },
    {
      userId: "user-04",
      locationId: locEast1.id,
      dayOfWeek: 6,
      startH: 10,
      startM: 0,
      endH: 18,
      endM: 0,
    },
  ];
  for (const a of availWindows) {
    const startsAt = new Date(baseAvail);
    startsAt.setUTCDate(
      startsAt.getUTCDate() + (a.dayOfWeek === 0 ? 7 : a.dayOfWeek),
    );
    startsAt.setUTCHours(a.startH, a.startM, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setUTCHours(a.endH > a.startH ? a.endH : a.endH + 24, a.endM, 0, 0);
    await prisma.availabilityWindow.upsert({
      where: { id: `avail-${a.userId}-${a.locationId}-${a.dayOfWeek}` },
      update: {},
      create: {
        id: `avail-${a.userId}-${a.locationId}-${a.dayOfWeek}`,
        userId: a.userId,
        locationId: a.locationId,
        startsAt,
        endsAt,
        dayOfWeek: a.dayOfWeek,
        isRecurring: true,
      },
    });
  }
  console.log("Created availability windows");

  // ==========================================================================
  // AUDIT LOG (sample entry)
  // ==========================================================================
  await prisma.auditLog.upsert({
    where: { id: "audit-sample" },
    update: {},
    create: {
      id: "audit-sample",
      userId: "user-mgr-ny",
      action: "SHIFT_ASSIGNED",
      entityType: "ShiftAssignment",
      entityId: m1.id,
      locationId: locEast1.id,
      changes: {
        before: null,
        after: { shiftId: m1.shiftId, userId: m1.userId, status: "confirmed" },
      },
    },
  });
  console.log("Created sample audit log");

  console.log("\n✅ Seed complete. Login: admin@shiftsync.local / password123");
  console.log(
    "   Scenarios: Morgan ~39h, Riley 5 consecutive days, Casey premium imbalance,",
  );
  console.log("   Drew expiring cert, Quinn↔Avery pending swap.");
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
