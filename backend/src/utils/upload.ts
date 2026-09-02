import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";

export const UPLOAD_ROOT = path.join(__dirname, "../../uploads");
export const ASSET_DOCUMENTS_DIR = path.join(UPLOAD_ROOT, "assets");
export const BRANDING_DIR = path.join(UPLOAD_ROOT, "branding");
export const TICKET_ATTACHMENTS_DIR = path.join(UPLOAD_ROOT, "helpdesk");
export const TASK_ATTACHMENTS_DIR = path.join(UPLOAD_ROOT, "tasks");

fs.mkdirSync(ASSET_DOCUMENTS_DIR, { recursive: true });
fs.mkdirSync(BRANDING_DIR, { recursive: true });
fs.mkdirSync(TICKET_ATTACHMENTS_DIR, { recursive: true });
fs.mkdirSync(TASK_ATTACHMENTS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ASSET_DOCUMENTS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const uploadAssetDocument = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported file type"));
      return;
    }
    cb(null, true);
  },
});

const ticketAttachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TICKET_ATTACHMENTS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const uploadTicketAttachment = multer({
  storage: ticketAttachmentStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported file type"));
      return;
    }
    cb(null, true);
  },
});

// Task attachments' own, much smaller limit - this feature's explicit requirement, distinct from
// every other upload path's 10MB default.
const MAX_TASK_ATTACHMENT_SIZE_BYTES = 500 * 1024; // 500KB

const taskAttachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TASK_ATTACHMENTS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const uploadTaskAttachment = multer({
  storage: taskAttachmentStorage,
  limits: { fileSize: MAX_TASK_ATTACHMENT_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported file type"));
      return;
    }
    cb(null, true);
  },
});

const SPREADSHEET_MIME_TYPES = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream", // some browsers send this for .csv
]);

/** CSV/Excel bulk-import uploads: kept in memory only, never written to disk. */
export const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!SPREADSHEET_MIME_TYPES.has(file.mimetype) && ![".csv", ".xlsx", ".xls"].includes(ext)) {
      cb(new Error("Unsupported file type - upload a CSV or Excel file"));
      return;
    }
    cb(null, true);
  },
});

// SVG deliberately excluded: it's the one image format that can carry an embedded <script>/event
// handler, and the logo is served back publicly/unauthenticated (settings.controller.ts's
// getLogoImage, with Content-Type set from the file extension) - a malicious or compromised org
// admin could otherwise plant a persistent XSS payload that runs in this app's own origin for
// anyone who navigates directly to the raw logo URL (not just <img>-embeds it).
const LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/** Branding logo: kept in memory so the controller can pick the on-disk filename (always "logo.<ext>"). */
export const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LOGO_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!LOGO_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported file type - upload a PNG, JPG, or WEBP image"));
      return;
    }
    cb(null, true);
  },
});
