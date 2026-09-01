import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type JwtPayload = {
  sub: string;
  tokenVersion: number;
  // Epoch ms of the last request that was accepted as "active" - re-signed on every valid
  // authenticated request (see middleware/authenticate.ts) to slide the idle-timeout window
  // forward. Independent of the JWT's own exp claim, which stays a fixed outer cap.
  lastActivity: number;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
