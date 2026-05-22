import assert from "node:assert/strict";
import test from "node:test";
import {
  ScheduleRuleError,
  validateNoShiftOverlap,
  validateRequiredCertification,
  validateWeeklyHours,
} from "./scheduleRules";

function createDate(value: string) {
  return new Date(value);
}

test("overlapping shift rejected", () => {
  assert.throws(
    () =>
      validateNoShiftOverlap(
        [
          {
            startAt: createDate("2026-01-05T06:00:00.000Z"),
            endAt: createDate("2026-01-05T14:00:00.000Z"),
          },
        ],
        {
          startAt: createDate("2026-01-05T13:00:00.000Z"),
          endAt: createDate("2026-01-05T21:00:00.000Z"),
        },
        "Alice Tan",
      ),
    (error) =>
      error instanceof ScheduleRuleError && error.code === "SHIFT_OVERLAP",
  );
});

test("back-to-back shift allowed", () => {
  assert.doesNotThrow(() =>
    validateNoShiftOverlap(
      [
        {
          startAt: createDate("2026-01-05T06:00:00.000Z"),
          endAt: createDate("2026-01-05T14:00:00.000Z"),
        },
      ],
      {
        startAt: createDate("2026-01-05T14:00:00.000Z"),
        endAt: createDate("2026-01-05T22:00:00.000Z"),
      },
      "Alice Tan",
    ),
  );
});

test("exactly 40 hours allowed", () => {
  assert.doesNotThrow(() =>
    validateWeeklyHours(
      [
        {
          startAt: createDate("2026-01-05T06:00:00.000Z"),
          endAt: createDate("2026-01-05T14:00:00.000Z"),
        },
        {
          startAt: createDate("2026-01-06T06:00:00.000Z"),
          endAt: createDate("2026-01-06T14:00:00.000Z"),
        },
        {
          startAt: createDate("2026-01-07T06:00:00.000Z"),
          endAt: createDate("2026-01-07T14:00:00.000Z"),
        },
        {
          startAt: createDate("2026-01-08T06:00:00.000Z"),
          endAt: createDate("2026-01-08T14:00:00.000Z"),
        },
      ],
      {
        startAt: createDate("2026-01-09T06:00:00.000Z"),
        endAt: createDate("2026-01-09T14:00:00.000Z"),
      },
      "Bob Lee",
    ),
  );
});

test("over 40 hours rejected", () => {
  assert.throws(
    () =>
      validateWeeklyHours(
        [
          {
            startAt: createDate("2026-01-05T06:00:00.000Z"),
            endAt: createDate("2026-01-05T14:00:00.000Z"),
          },
          {
            startAt: createDate("2026-01-06T06:00:00.000Z"),
            endAt: createDate("2026-01-06T14:00:00.000Z"),
          },
          {
            startAt: createDate("2026-01-07T06:00:00.000Z"),
            endAt: createDate("2026-01-07T14:00:00.000Z"),
          },
          {
            startAt: createDate("2026-01-08T06:00:00.000Z"),
            endAt: createDate("2026-01-08T14:00:00.000Z"),
          },
          {
            startAt: createDate("2026-01-09T06:00:00.000Z"),
            endAt: createDate("2026-01-09T14:00:00.000Z"),
          },
        ],
        {
          startAt: createDate("2026-01-10T06:00:00.000Z"),
          endAt: createDate("2026-01-10T14:00:00.000Z"),
        },
        "Bob Lee",
      ),
    (error) =>
      error instanceof ScheduleRuleError &&
      error.code === "WEEKLY_HOURS_EXCEEDED",
  );
});

test("missing certification rejected", () => {
  assert.throws(
    () =>
      validateRequiredCertification(
        "NIGHT",
        "Electrical",
        "Alice Tan",
        ["First Aid", "Cleaning Safety"],
      ),
    (error) =>
      error instanceof ScheduleRuleError &&
      error.code === "CERTIFICATION_REQUIRED",
  );
});
