import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type JwtPayload = {
  sub: string;
  tokenVersion: number;
  // Epoch ms, refreshed on a throttled basis by middleware/authenticate.ts whenever the org's
  // idleTimeoutMinutes is enabled - a sliding window driven by the browser's own normal API
  // traffic, checked against that setting to expire a session early for inactivity. Absent (old
  // tokens signed before this field existed) is treated as "never idle" by authenticate.ts.
  lastActivity?: number;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
