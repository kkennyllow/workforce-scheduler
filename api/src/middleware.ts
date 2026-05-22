import type { NextFunction, Request, Response } from "express";
import { UserRole, type User } from "@prisma/client";
import { authCookieName, verifyAuthToken } from "./auth";
import { prisma } from "./db";

export type AuthenticatedUser = Pick<User, "id" | "name" | "email" | "role">;

export type AuthenticatedRequest = Request & {
  currentUser: AuthenticatedUser;
};

function sendUnauthenticated(response: Response) {
  response.status(401).json({
    error: "Unauthenticated",
    message: "You must be logged in to access this resource.",
  });
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const token = request.cookies[authCookieName];

  if (typeof token !== "string" || token.length === 0) {
    sendUnauthenticated(response);
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      sendUnauthenticated(response);
      return;
    }

    (request as AuthenticatedRequest).currentUser = user;
    next();
  } catch {
    sendUnauthenticated(response);
  }
}

export function requireSupervisor(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const authenticatedRequest = request as AuthenticatedRequest;

  if (authenticatedRequest.currentUser.role !== UserRole.SUPERVISOR) {
    response.status(403).json({
      error: "Forbidden",
      message: "Supervisor access is required for this resource.",
    });
    return;
  }

  next();
}

export function requireStaff(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const authenticatedRequest = request as AuthenticatedRequest;

  if (authenticatedRequest.currentUser.role !== UserRole.STAFF) {
    response.status(403).json({
      error: "Forbidden",
      message: "Staff access is required for this resource.",
    });
    return;
  }

  next();
}
