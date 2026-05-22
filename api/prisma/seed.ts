import bcrypt from "bcrypt";
import { ShiftKind, UserRole } from "@prisma/client";
import { prisma } from "../src/db";

const seededPassword = "password123";
const saltRounds = 10;
const shiftSiteName = "Central Operations Hub";

function createUtcDate(year: number, month: number, day: number, hour: number) {
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
}

async function main() {
  const passwordHash = await bcrypt.hash(seededPassword, saltRounds);

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@example.com" },
    update: {
      name: "Scheduler Supervisor",
      role: UserRole.SUPERVISOR,
      passwordHash,
    },
    create: {
      email: "supervisor@example.com",
      name: "Scheduler Supervisor",
      role: UserRole.SUPERVISOR,
      passwordHash,
    },
  });

  const staffUserInputs = [
    { email: "alice@example.com", name: "Alice Tan" },
    { email: "bob@example.com", name: "Bob Lee" },
    { email: "carol@example.com", name: "Carol Lim" },
    { email: "dan@example.com", name: "Dan Wong" },
    { email: "eve@example.com", name: "Eve Kumar" },
  ];
  const staffUsers: Array<Awaited<ReturnType<typeof prisma.user.upsert>>> = [];

  for (const user of staffUserInputs) {
    const staffUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: UserRole.STAFF,
        passwordHash,
      },
      create: {
        ...user,
        role: UserRole.STAFF,
        passwordHash,
      },
    });

    staffUsers.push(staffUser);
  }

  const sites: Array<Awaited<ReturnType<typeof prisma.site.upsert>>> = [];

  for (const name of [
    "Central Operations Hub",
    "North Distribution Center",
    "Harbor Logistics Yard",
    "West Service Depot",
  ]) {
    const site = await prisma.site.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    sites.push(site);
  }

  const certifications: Array<
    Awaited<ReturnType<typeof prisma.certification.upsert>>
  > = [];

  for (const name of ["First Aid", "Electrical", "Cleaning Safety"]) {
    const certification = await prisma.certification.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    certifications.push(certification);
  }

  const staffProfiles: Array<
    Awaited<ReturnType<typeof prisma.staffProfile.upsert>>
  > = [];

  for (const user of staffUsers) {
    const staffProfile = await prisma.staffProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    staffProfiles.push(staffProfile);
  }

  const certificationByName = new Map(certifications.map((certification) => [certification.name, certification]));
  const profileByEmail = new Map(staffUsers.map((user, index) => [user.email, staffProfiles[index]]));

  const certificationMatrix: Record<string, string[]> = {
    "alice@example.com": ["First Aid", "Cleaning Safety"],
    "bob@example.com": ["Electrical"],
    "carol@example.com": ["First Aid", "Electrical"],
    "dan@example.com": ["Cleaning Safety"],
    "eve@example.com": ["First Aid"],
  };

  await Promise.all(
    Object.entries(certificationMatrix).flatMap(([email, certificationNames]) => {
      const staffProfile = profileByEmail.get(email);

      if (!staffProfile) {
        return [];
      }

      return certificationNames.map((certificationName) => {
        const certification = certificationByName.get(certificationName);

        if (!certification) {
          throw new Error(`Missing certification ${certificationName}`);
        }

        return prisma.staffCertification.upsert({
          where: {
            staffProfileId_certificationId: {
              staffProfileId: staffProfile.id,
              certificationId: certification.id,
            },
          },
          update: {},
          create: {
            staffProfileId: staffProfile.id,
            certificationId: certification.id,
          },
        });
      });
    }),
  );

  const primarySite = sites.find((site) => site.name === shiftSiteName);

  if (!primarySite) {
    throw new Error(`Missing site ${shiftSiteName}`);
  }

  const assignmentPlan = [
    "alice@example.com",
    "dan@example.com",
    "bob@example.com",
    "carol@example.com",
    null,
    null,
    "eve@example.com",
    "alice@example.com",
    null,
    "carol@example.com",
    "dan@example.com",
    "bob@example.com",
    "alice@example.com",
    null,
    "carol@example.com",
    "eve@example.com",
    "dan@example.com",
    null,
    "carol@example.com",
    "alice@example.com",
    "bob@example.com",
  ];

  const shiftTemplates = [
    {
      kind: ShiftKind.MORNING,
      startHour: 6,
      endHour: 14,
      requiredCertificationName: "First Aid",
    },
    {
      kind: ShiftKind.AFTERNOON,
      startHour: 14,
      endHour: 22,
      requiredCertificationName: "Cleaning Safety",
    },
    {
      kind: ShiftKind.NIGHT,
      startHour: 22,
      endHour: 30,
      requiredCertificationName: "Electrical",
    },
  ];

  const shifts = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const day = 5 + dayOffset;

    for (const template of shiftTemplates) {
      const startAt = createUtcDate(2026, 1, day, template.startHour % 24);
      const endDay = template.endHour >= 24 ? day + 1 : day;
      const endAt = createUtcDate(2026, 1, endDay, template.endHour % 24);
      const requiredCertification = certificationByName.get(template.requiredCertificationName);

      const shift = await prisma.shift.upsert({
        where: {
          siteId_startAt: {
            siteId: primarySite.id,
            startAt,
          },
        },
        update: {
          kind: template.kind,
          endAt,
          requiredCertificationId: requiredCertification?.id ?? null,
        },
        create: {
          siteId: primarySite.id,
          kind: template.kind,
          startAt,
          endAt,
          requiredCertificationId: requiredCertification?.id ?? null,
        },
      });

      shifts.push(shift);
    }
  }

  for (let index = 0; index < shifts.length; index += 1) {
    const shift = shifts[index];
    const assigneeEmail = assignmentPlan[index];

    if (!assigneeEmail) {
      await prisma.assignment.deleteMany({
        where: { shiftId: shift.id },
      });
      continue;
    }

    const staffProfile = profileByEmail.get(assigneeEmail);

    if (!staffProfile) {
      throw new Error(`Missing staff profile for ${assigneeEmail}`);
    }

    await prisma.assignment.upsert({
      where: { shiftId: shift.id },
      update: { staffProfileId: staffProfile.id },
      create: {
        shiftId: shift.id,
        staffProfileId: staffProfile.id,
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Supervisor: supervisor@example.com / ${seededPassword}`);
  console.log(`Staff: alice@example.com / ${seededPassword}`);
  console.log(`Staff: bob@example.com / ${seededPassword}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
