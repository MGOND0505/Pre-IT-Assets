import { Schema, model, type Types } from "mongoose";

export interface ILoginHistory {
  organization: Types.ObjectId | null;
  user: Types.ObjectId | null;
  emailAttempted: string;
  action: "login_success" | "login_failed" | "logout";
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  // null = CAPTCHA wasn't required for this attempt (disabled for the org, or the org-agnostic
  // superAdmin login). true/false = required, and whether it was actually solved.
  captchaVerified: boolean | null;
}

const loginHistorySchema = new Schema<ILoginHistory>(
  {
    // null for the org-agnostic superAdmin login flow (no orgSlug given).
    organization: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    emailAttempted: { type: String, required: true, trim: true, lowercase: true },
    action: { type: String, enum: ["login_success", "login_failed", "logout"], required: true },
    reason: { type: String, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    captchaVerified: { type: Boolean, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

loginHistorySchema.index({ user: 1, createdAt: -1 });

export const LoginHistory = model<ILoginHistory>("LoginHistory", loginHistorySchema);
