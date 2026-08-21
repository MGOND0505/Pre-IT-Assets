import { Schema, model } from "mongoose";

export interface IPermission {
  module: string;
  action: string;
  key: string;
  description: string;
}

const permissionSchema = new Schema<IPermission>({
  module: { type: String, required: true },
  action: { type: String, required: true },
  key: { type: String, required: true, unique: true },
  description: { type: String, required: true },
});

export const Permission = model<IPermission>("Permission", permissionSchema);
