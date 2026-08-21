import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
mongoose.connection.on("error", (err) => logger.error(`MongoDB connection error: ${err.message}`));

export async function connectDB(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
