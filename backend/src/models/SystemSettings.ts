import { Schema, model } from "mongoose";

export interface ISystemSettings {
  assetIdCompanyPrefix: string;
  warrantyAlertDays: number;
  amcAlertDays: number;
  licenseRenewalAlertDays: number[];
  licenseIdPrefix: string;
}

const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    assetIdCompanyPrefix: { type: String, default: "VNR", trim: true, uppercase: true },
    warrantyAlertDays: { type: Number, default: 30 },
    amcAlertDays: { type: Number, default: 30 },
    licenseRenewalAlertDays: { type: [Number], default: [90, 60, 30, 15, 7] },
    licenseIdPrefix: { type: String, default: "LIC", trim: true, uppercase: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const SystemSettings = model<ISystemSettings>("SystemSettings", systemSettingsSchema);
