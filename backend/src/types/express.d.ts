declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tokenVersion: number;
        roleNames: string[];
        permissions: string[];
        isSuperAdmin: boolean;
      };
    }
  }
}

export {};
