import swaggerJsdoc from "swagger-jsdoc";
import path from "node:path";

// swagger-jsdoc resolves `apis` patterns with `glob`, which treats `\` as an escape
// character even on Windows - path.join's backslashes silently match zero files there.
function toGlobPath(...segments: string[]): string {
  return path.join(...segments).split(path.sep).join("/");
}

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "IT Asset & License Management API",
      version: "0.1.0",
      description: "REST API for Vianaar's IT Asset & Software License Management System",
    },
    servers: [{ url: "/api" }],
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "itam_token" },
      },
    },
  },
  apis: [toGlobPath(__dirname, "../modules/**/*.routes.ts"), toGlobPath(__dirname, "../modules/**/*.routes.js")],
});
