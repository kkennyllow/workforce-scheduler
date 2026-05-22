-- Create enums
CREATE TYPE "UserRole" AS ENUM ('SUPERVISOR', 'STAFF');
CREATE TYPE "ShiftKind" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT');

-- Create tables
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Site" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Certification" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffCertification" (
    "id" SERIAL NOT NULL,
    "staffProfileId" INTEGER NOT NULL,
    "certificationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffCertification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Shift" (
    "id" SERIAL NOT NULL,
    "siteId" INTEGER NOT NULL,
    "kind" "ShiftKind" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "requiredCertificationId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Assignment" (
    "id" SERIAL NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "staffProfileId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Site_name_key" ON "Site"("name");
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");
CREATE UNIQUE INDEX "Certification_name_key" ON "Certification"("name");
CREATE UNIQUE INDEX "StaffCertification_staffProfileId_certificationId_key" ON "StaffCertification"("staffProfileId", "certificationId");
CREATE UNIQUE INDEX "Shift_siteId_startAt_key" ON "Shift"("siteId", "startAt");
CREATE UNIQUE INDEX "Assignment_shiftId_key" ON "Assignment"("shiftId");

-- Add foreign keys
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffCertification" ADD CONSTRAINT "StaffCertification_staffProfileId_fkey"
FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffCertification" ADD CONSTRAINT "StaffCertification_certificationId_fkey"
FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_requiredCertificationId_fkey"
FOREIGN KEY ("requiredCertificationId") REFERENCES "Certification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_shiftId_fkey"
FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_staffProfileId_fkey"
FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
