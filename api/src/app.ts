import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { clearAuthCookie, setAuthCookie, signAuthToken } from "./auth";
import { prisma } from "./db";
import {
  requireAuth,
  requireSupervisor,
  type AuthenticatedRequest,
} from "./middleware";
import {
  ScheduleRuleError,
  getWeekWindow,
  validateNoShiftOverlap,
  validateRequiredCertification,
  validateWeeklyHours,
} from "./scheduleRules";

const defaultCorsOrigin = "http://localhost:5173";
const millisecondsPerDay = 24 * 60 * 60 * 1000;

export const app = express();

function parseInteger(value: string) {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) ? parsedValue : null;
}

function parseWeekStart(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function getWeekEnd(weekStart: Date) {
  return new Date(weekStart.getTime() + 7 * millisecondsPerDay);
}

function formatShiftResponse(shift: {
  id: number;
  siteId: number;
  kind: string;
  startAt: Date;
  endAt: Date;
  requiredCertification: { id: number; name: string } | null;
  assignment: {
    id: number;
    staffProfile: {
      id: number;
      user: { id: number; name: string; email: string; role: string };
    };
  } | null;
}) {
  return {
    id: shift.id,
    siteId: shift.siteId,
    kind: shift.kind,
    startAt: shift.startAt,
    endAt: shift.endAt,
    requiredCertification: shift.requiredCertification,
    assignment: shift.assignment
      ? {
          id: shift.assignment.id,
          staffId: shift.assignment.staffProfile.id,
          user: shift.assignment.staffProfile.user,
        }
      : null,
  };
}

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? defaultCorsOrigin,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/auth/login", async (request, response) => {
  const { email, password } = request.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    response.status(400).json({
      error: "InvalidRequest",
      message: "Email and password are required.",
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      passwordHash: true,
    },
  });

  if (!user) {
    response.status(401).json({
      error: "InvalidLogin",
      message: "Invalid email or password.",
    });
    return;
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    response.status(401).json({
      error: "InvalidLogin",
      message: "Invalid email or password.",
    });
    return;
  }

  const token = signAuthToken(user.id, user.role);
  setAuthCookie(response, token);

  response.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});

app.post("/api/auth/logout", (_request, response) => {
  clearAuthCookie(response);
  response.json({
    success: true,
    message: "Logged out successfully.",
  });
});

app.get("/api/me", requireAuth, (request, response) => {
  const { currentUser } = request as AuthenticatedRequest;
  response.json(currentUser);
});

app.get(
  "/api/auth/supervisor-check",
  requireAuth,
  requireSupervisor,
  (request, response) => {
    const { currentUser } = request as AuthenticatedRequest;
    response.json({
      success: true,
      message: "Supervisor access confirmed.",
      user: currentUser,
    });
  },
);

app.get("/api/sites", requireAuth, async (_request, response) => {
  const sites = await prisma.site.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });

  response.json(sites);
});

app.get("/api/schedule", requireAuth, async (request, response) => {
  const siteId = parseInteger(String(request.query.siteId ?? ""));
  const weekStart = parseWeekStart(request.query.weekStart);

  if (siteId === null || weekStart === null) {
    response.status(400).json({
      error: "InvalidRequest",
      message: "siteId and weekStart=YYYY-MM-DD are required.",
    });
    return;
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!site) {
    response.status(404).json({
      error: "NotFound",
      message: "Site not found.",
    });
    return;
  }

  const weekEnd = getWeekEnd(weekStart);
  const shifts = await prisma.shift.findMany({
    where: {
      siteId,
      startAt: {
        gte: weekStart,
        lt: weekEnd,
      },
    },
    orderBy: {
      startAt: "asc",
    },
    select: {
      id: true,
      siteId: true,
      kind: true,
      startAt: true,
      endAt: true,
      requiredCertification: {
        select: {
          id: true,
          name: true,
        },
      },
      assignment: {
        select: {
          id: true,
          staffProfile: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      },
    },
  });

  response.json({
    site,
    weekStart,
    weekEnd,
    shifts: shifts.map(formatShiftResponse),
  });
});

app.get(
  "/api/staff",
  requireAuth,
  requireSupervisor,
  async (_request, response) => {
    const staffProfiles = await prisma.staffProfile.findMany({
      orderBy: {
        id: "asc",
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        certifications: {
          select: {
            certification: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    response.json(
      staffProfiles.map((staffProfile) => ({
        id: staffProfile.id,
        user: staffProfile.user,
        certifications: staffProfile.certifications.map(
          ({ certification }) => certification,
        ),
      })),
    );
  },
);

app.get("/api/my-shifts", requireAuth, async (request, response) => {
  const weekStart = parseWeekStart(request.query.weekStart);
  const { currentUser } = request as AuthenticatedRequest;

  if (weekStart === null) {
    response.status(400).json({
      error: "InvalidRequest",
      message: "weekStart=YYYY-MM-DD is required.",
    });
    return;
  }

  const staffProfile = await prisma.staffProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true },
  });

  if (!staffProfile) {
    response.json({
      weekStart,
      weekEnd: getWeekEnd(weekStart),
      shifts: [],
    });
    return;
  }

  const weekEnd = getWeekEnd(weekStart);
  const assignments = await prisma.assignment.findMany({
    where: {
      staffProfileId: staffProfile.id,
      shift: {
        startAt: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
    },
    orderBy: {
      shift: {
        startAt: "asc",
      },
    },
    select: {
      id: true,
      shift: {
        select: {
          id: true,
          siteId: true,
          kind: true,
          startAt: true,
          endAt: true,
          requiredCertification: {
            select: {
              id: true,
              name: true,
            },
          },
          site: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  response.json({
    weekStart,
    weekEnd,
    shifts: assignments.map((assignment) => ({
      assignmentId: assignment.id,
      ...formatShiftResponse({
        ...assignment.shift,
        assignment: {
          id: assignment.id,
          staffProfile: {
            id: staffProfile.id,
            user: currentUser,
          },
        },
      }),
      site: assignment.shift.site,
    })),
  });
});

app.put(
  "/api/shifts/:shiftId/assignment",
  requireAuth,
  requireSupervisor,
  async (request, response) => {
    const shiftId = parseInteger(String(request.params.shiftId));
    const { staffId } = request.body as { staffId?: number | null };

    if (
      shiftId === null ||
      (staffId !== null && staffId !== undefined && !Number.isInteger(staffId))
    ) {
      response.status(400).json({
        error: "InvalidRequest",
        message: "shiftId must be valid and staffId must be an integer or null.",
      });
      return;
    }

    try {
      const updatedShift = await prisma.$transaction(async (transaction) => {
        const shift = await transaction.shift.findUnique({
          where: { id: shiftId },
          select: {
            id: true,
            siteId: true,
            kind: true,
            startAt: true,
            endAt: true,
            requiredCertification: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!shift) {
          return null;
        }

        if (staffId === null) {
          await transaction.assignment.deleteMany({
            where: { shiftId },
          });
        } else {
          const staffProfile = await transaction.staffProfile.findUnique({
            where: { id: staffId },
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
              certifications: {
                select: {
                  certification: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          });

          if (!staffProfile) {
            throw new Error("STAFF_NOT_FOUND");
          }

          validateRequiredCertification(
            shift.kind,
            shift.requiredCertification?.name ?? null,
            staffProfile.user.name,
            staffProfile.certifications.map(
              ({ certification }) => certification.name,
            ),
          );

          const overlappingAssignments = await transaction.assignment.findMany({
            where: {
              staffProfileId: staffProfile.id,
              shiftId: { not: shift.id },
              shift: {
                startAt: { lt: shift.endAt },
                endAt: { gt: shift.startAt },
              },
            },
            select: {
              shift: {
                select: {
                  id: true,
                  startAt: true,
                  endAt: true,
                },
              },
            },
          });

          validateNoShiftOverlap(
            overlappingAssignments.map(({ shift: existingShift }) => existingShift),
            shift,
            staffProfile.user.name,
          );

          const { weekStart, weekEnd } = getWeekWindow(shift.startAt);
          const weeklyAssignments = await transaction.assignment.findMany({
            where: {
              staffProfileId: staffProfile.id,
              shiftId: { not: shift.id },
              shift: {
                startAt: {
                  gte: weekStart,
                  lt: weekEnd,
                },
              },
            },
            select: {
              shift: {
                select: {
                  id: true,
                  startAt: true,
                  endAt: true,
                },
              },
            },
          });

          validateWeeklyHours(
            weeklyAssignments.map(({ shift: weeklyShift }) => weeklyShift),
            shift,
            staffProfile.user.name,
          );

          await transaction.assignment.upsert({
            where: { shiftId },
            update: { staffProfileId: staffProfile.id },
            create: {
              shiftId,
              staffProfileId: staffProfile.id,
            },
          });
        }

        return transaction.shift.findUnique({
          where: { id: shiftId },
          select: {
            id: true,
            siteId: true,
            kind: true,
            startAt: true,
            endAt: true,
            requiredCertification: {
              select: {
                id: true,
                name: true,
              },
            },
            assignment: {
              select: {
                id: true,
                staffProfile: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
      });

      if (updatedShift === null) {
        response.status(404).json({
          error: "NotFound",
          message: "Shift not found.",
        });
        return;
      }

      response.json({
        shift: formatShiftResponse(updatedShift),
      });
    } catch (error) {
      if (error instanceof ScheduleRuleError) {
        response.status(422).json({
          error: error.code,
          message: error.message,
        });
        return;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        response.status(409).json({
          error: "DATABASE_CONFLICT",
          message: "The assignment could not be saved because of a database conflict.",
        });
        return;
      }

      if (error instanceof Error && error.message === "STAFF_NOT_FOUND") {
        response.status(404).json({
          error: "NotFound",
          message: "Staff member not found.",
        });
        return;
      }

      response.status(500).json({
        error: "InternalServerError",
        message: "An unexpected error occurred while updating the assignment.",
      });
    }
  },
);
