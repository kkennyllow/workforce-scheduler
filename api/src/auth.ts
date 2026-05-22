import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import type { Response } from "express";

export const authCookieName = "workforce_scheduler_token";

type AuthTokenPayload = {
  sub: number;
  role: UserRole;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

export function signAuthToken(userId: number, role: UserRole) {
  return jwt.sign({ sub: userId, role }, getJwtSecret(), {
    expiresIn: "7d",
  });
}

export function verifyAuthToken(token: string) {
  const payload = jwt.verify(token, getJwtSecret());

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.sub !== "number" ||
    typeof payload.role !== "string"
  ) {
    throw new Error("Invalid auth token payload");
  }

  return {
    sub: payload.sub,
    role: payload.role,
  };
}

export function setAuthCookie(response: Response, token: string) {
  response.cookie(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(response: Response) {
  response.clearCookie(authCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
