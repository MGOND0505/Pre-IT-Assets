import type { PermissionsShape } from "../config/permissions";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tokenVersion: number;
        isAdmin: boolean;
        permissions: PermissionsShape;
        department: string | null;
        location: string | null;
      };
    }
  }
}

export {};
