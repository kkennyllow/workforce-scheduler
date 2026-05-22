import type { ShiftKind } from "@prisma/client";

export type RuleErrorCode =
  | "SHIFT_OVERLAP"
  | "WEEKLY_HOURS_EXCEEDED"
  | "CERTIFICATION_REQUIRED";

export class ScheduleRuleError extends Error {
  code: RuleErrorCode;

  constructor(code: RuleErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ScheduleRuleError";
  }
}

export type ShiftWindow = {
  id?: number;
  startAt: Date;
  endAt: Date;
};

export function shiftsOverlap(existingShift: ShiftWindow, newShift: ShiftWindow) {
  return (
    existingShift.startAt < newShift.endAt && newShift.startAt < existingShift.endAt
  );
}

export function getShiftDurationHours(shift: ShiftWindow) {
  return (shift.endAt.getTime() - shift.startAt.getTime()) / (1000 * 60 * 60);
}

export function getWeekWindow(date: Date) {
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const weekStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  return { weekStart, weekEnd };
}

export function validateNoShiftOverlap(
  existingShifts: ShiftWindow[],
  newShift: ShiftWindow,
  staffName: string,
) {
  const conflictingShift = existingShifts.find((shift) => shiftsOverlap(shift, newShift));

  if (!conflictingShift) {
    return;
  }

  throw new ScheduleRuleError(
    "SHIFT_OVERLAP",
    `${staffName} already has an overlapping shift during this time window.`,
  );
}

export function validateWeeklyHours(
  existingShifts: ShiftWindow[],
  newShift: ShiftWindow,
  staffName: string,
  maxHours = 40,
) {
  const totalHours =
    existingShifts.reduce((sum, shift) => sum + getShiftDurationHours(shift), 0) +
    getShiftDurationHours(newShift);

  if (totalHours > maxHours) {
    throw new ScheduleRuleError(
      "WEEKLY_HOURS_EXCEEDED",
      `${staffName} would be scheduled for ${totalHours} hours this week, which exceeds the ${maxHours} hour limit.`,
    );
  }
}

function formatShiftKind(kind: ShiftKind) {
  return `${kind.charAt(0)}${kind.slice(1).toLowerCase()}`;
}

export function validateRequiredCertification(
  shiftKind: ShiftKind,
  requiredCertificationName: string | null,
  staffName: string,
  staffCertificationNames: string[],
) {
  if (
    !requiredCertificationName ||
    staffCertificationNames.includes(requiredCertificationName)
  ) {
    return;
  }

  throw new ScheduleRuleError(
    "CERTIFICATION_REQUIRED",
    `${formatShiftKind(shiftKind)} shift requires ${requiredCertificationName}. ${staffName} does not have this certification.`,
  );
}
