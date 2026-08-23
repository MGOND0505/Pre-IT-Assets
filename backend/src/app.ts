import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import { apiRouter } from "./routes/index";
import { apiLimiter } from "./middleware/rateLimit";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
// The default 100kb limit is too small for the bulk import confirm step, which resends
// the full previewed row set (mirrors the 10MB upload limit in utils/upload.ts).
app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());
app.use(mongoSanitize());

if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", apiLimiter, apiRouter);

app.use(notFound);
app.use(errorHandler);
