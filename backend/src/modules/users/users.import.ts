import crypto from "node:crypto";
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { parseSpreadsheet, findColumn } from "../../utils/spreadsheet";
import { User, type IUser } from "../../models/User";
import { Department } from "../../models/Department";
import { Location } from "../../models/Location";
import { logAction } from "../audit/audit.service";
import { recordImportBatch, listImportBatches } from "../importHistory/importHistory.service";
import * as usersService from "./users.service";
import * as authService from "../auth/auth.service";

/** Canonical column headers - what "Download template" hands back. Deliberately does NOT include
 * password, role, or permissions - a bulk-imported user is always a plain teamMember; an admin
 * can widen access afterward via the existing Edit Permissions dialog. Keeping those columns out
 * of the file entirely means there's no privilege-escalation surface to worry about in this
 * importer at all. */
export const USER_IMPORT_TEMPLATE_COLUMNS = ["Name", "Email", "Employee ID", "Designation", "Phone", "Department", "Location"];

type MappedFields = {
  name: string;
  email: string;
  employeeId: string;
  designation: string;
  phone: string;
  departmentName: string;
  locationName: string;
};

export type MappedUserRow = {
  rowIndex: number;
  mapped: MappedFields;
  classification: "new" | "updated" | "duplicate" | "invalid";
  reason?: string;
  existingId?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim() === "";
}

function normalize(value: string | null | undefined): string {
  return isBlank(value) ? "" : value!.trim().toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapRow(row: Record<string, string>): MappedFields {
  return {
    name: findColumn(row, ["Name", "Full Name"]),
    email: findColumn(row, ["Email", "Email ID", "Email Address"]),
    employeeId: findColumn(row, ["Employee ID", "Emp ID", "EmployeeId"]),
    designation: findColumn(row, ["Designation", "Role / Designation", "Title"]),
    phone: findColumn(row, ["Phone", "Phone Number", "Mobile"]),
    departmentName: findColumn(row, ["Department"]),
    locationName: findColumn(row, ["Location"]),
  };
}

const STRING_DIFF_FIELDS: (keyof MappedFields & keyof IUser)[] = ["name", "employeeId", "designation", "phone"];

type ExistingUser = IUser & {
  _id: unknown;
  department?: { name?: string } | null;
  location?: { name?: string } | null;
};

/** Only compares fields the row actually provides - a blank cell means "leave unchanged", not "clear this field". */
function diffAgainstExisting(mapped: MappedFields, existing: ExistingUser): string[] {
  const changed: string[] = [];

  for (const field of STRING_DIFF_FIELDS) {
    const incoming = mapped[field] as string;
    const current = existing[field] as string;
    if (!isBlank(incoming) && normalize(incoming) !== normalize(current)) changed.push(field);
  }

  if (!isBlank(mapped.departmentName) && normalize(mapped.departmentName) !== normalize(existing.department?.name)) {
    changed.push("department");
  }
  if (!isBlank(mapped.locationName) && normalize(mapped.locationName) !== normalize(existing.location?.name)) {
    changed.push("location");
  }

  return changed;
}

function hasAnyRecognizableColumn(rawRows: Record<string, string>[]): boolean {
  return rawRows.some((row) => {
    const mapped = mapRow(row);
    return !isBlank(mapped.name) || !isBlank(mapped.email);
  });
}

async function classifyRows(rawRows: Record<string, string>[], organizationId: string): Promise<MappedUserRow[]> {
  const existingUsers = (await User.find({ organization: organizationId, isDeleted: false }).populate([
    { path: "department", select: "name" },
    { path: "location", select: "name" },
  ])) as unknown as ExistingUser[];

  const byEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]));
  const byEmployeeId = new Map(
    existingUsers.filter((u) => !isBlank(u.employeeId)).map((u) => [u.employeeId!.toLowerCase(), u])
  );

  const seenInFile = new Set<string>();

  return rawRows.map((row, rowIndex) => {
    const mapped = mapRow(row);
    const emailKey = normalize(mapped.email);
    const employeeIdKey = normalize(mapped.employeeId);

    const existing = (emailKey && byEmail.get(emailKey)) || (employeeIdKey && byEmployeeId.get(employeeIdKey));
    const fileKey = emailKey || employeeIdKey;

    let classification: MappedUserRow["classification"];
    let reason: string | undefined;
    let existingId: string | undefined;

    if (existing) {
      existingId = String(existing._id);
      const changedFields = diffAgainstExisting(mapped, existing);

      if (fileKey && seenInFile.has(fileKey)) {
        classification = "duplicate";
        reason = "This user appears more than once in this file";
      } else if (changedFields.length > 0) {
        classification = "updated";
        reason = `${changedFields.length} field(s) will change: ${changedFields.join(", ")}`;
      } else {
        classification = "duplicate";
        reason = "No changes from the existing record";
      }
    } else if (isBlank(mapped.name)) {
      classification = "invalid";
      reason = "Missing name";
    } else if (isBlank(mapped.email) || !EMAIL_PATTERN.test(mapped.email)) {
      classification = "invalid";
      reason = mapped.email ? `Invalid email "${mapped.email}"` : "Missing email";
    } else if (fileKey && seenInFile.has(fileKey)) {
      classification = "duplicate";
      reason = "This user appears more than once in this file";
    } else {
      classification = "new";
    }

    if (fileKey) seenInFile.add(fileKey);

    return { rowIndex, mapped, classification, reason, existingId };
  });
}

export const previewUserImport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const rawRows = parseSpreadsheet(req.file.buffer);
  if (rawRows.length === 0) throw new ApiError(400, "The file has no data rows");
  if (!hasAnyRecognizableColumn(rawRows)) {
    throw new ApiError(400, "This file doesn't look like a user CSV - no Name or Email column was found. Try the template.");
  }

  const rows = await classifyRows(rawRows, req.organization!._id);
  const counts = {
    total: rows.length,
    new: rows.filter((r) => r.classification === "new").length,
    updated: rows.filter((r) => r.classification === "updated").length,
    duplicate: rows.filter((r) => r.classification === "duplicate").length,
    invalid: rows.filter((r) => r.classification === "invalid").length,
  };

  ok(res, { counts, rows }, "Import preview");
});

// Two explicitly-typed wrappers rather than one generic taking a union of model classes -
// Mongoose's static findOne()/create() overloads don't unify cleanly across different Model
// types in TypeScript (same issue already worked around in ai-tools.service.ts's
// resolveDepartmentByName/resolveLocationByName), so a shared generic just fights the type checker.
async function findOrCreateDepartment(name: string, organizationId: string) {
  if (isBlank(name)) return null;
  const existing = await Department.findOne({ organization: organizationId, name: new RegExp(`^${escapeRegExp(name.trim())}$`, "i") });
  if (existing) return existing;
  return Department.create({ organization: organizationId, name: name.trim() });
}

async function findOrCreateLocation(name: string, organizationId: string) {
  if (isBlank(name)) return null;
  const existing = await Location.findOne({ organization: organizationId, name: new RegExp(`^${escapeRegExp(name.trim())}$`, "i") });
  if (existing) return existing;
  return Location.create({ organization: organizationId, name: name.trim() });
}

/** Builds an update payload containing only the fields the row actually provides (blank = leave unchanged) - the
 * same "leave unchanged" semantics as the asset importer, and the same narrow field set
 * usersService.updateUser already only ever accepts (name/employeeId/designation/phone/department/location) -
 * nothing here can touch password, role, or permissions. */
async function buildPartialPayload(mapped: MappedFields, organizationId: string) {
  const payload: Record<string, unknown> = {};

  for (const field of STRING_DIFF_FIELDS) {
    const value = mapped[field] as string;
    if (!isBlank(value)) payload[field] = value;
  }

  if (!isBlank(mapped.departmentName)) {
    const department = await findOrCreateDepartment(mapped.departmentName, organizationId);
    payload.department = department ? String(department._id) : null;
  }
  if (!isBlank(mapped.locationName)) {
    const location = await findOrCreateLocation(mapped.locationName, organizationId);
    payload.location = location ? String(location._id) : null;
  }

  return payload;
}

export const confirmUserImport = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const orgSlug = req.organization!.slug;
  const rows = (req.body.rows as MappedUserRow[]) ?? [];
  const newRows = rows.filter((r) => r.classification === "new");
  const updatedRows = rows.filter((r) => r.classification === "updated");
  const duplicates = rows.filter((r) => r.classification === "duplicate").length;
  const invalid = rows.filter((r) => r.classification === "invalid").length;

  let added = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of newRows) {
    try {
      const [department, location] = await Promise.all([
        findOrCreateDepartment(row.mapped.departmentName, organizationId),
        findOrCreateLocation(row.mapped.locationName, organizationId),
      ]);

      // The password is immediately discarded - the new user gets a real password-reset email
      // below (same flow as "Forgot password"), never a plaintext temp password anyone could see.
      // Padded with a fixed "Aa1!" suffix so it structurally satisfies any configured password
      // policy (uppercase/number/special-char) regardless of org settings - it's random and never
      // used to log in either way, so this is just to avoid createUser's policy check rejecting it.
      const discardedPassword = `${crypto.randomBytes(24).toString("hex")}Aa1!`;

      await usersService.createUser(
        {
          name: row.mapped.name,
          email: row.mapped.email,
          employeeId: row.mapped.employeeId || undefined,
          designation: row.mapped.designation || undefined,
          phone: row.mapped.phone || undefined,
          department: department ? String(department._id) : undefined,
          location: location ? String(location._id) : undefined,
          password: discardedPassword,
          // No `permissions` here on purpose - createUser's own fallback applies the org's
          // configured default employee permissions (or the baseline, if never configured) so
          // this stays the one place that decision is made, not duplicated here too.
          createdBy: req.user!.id,
        },
        organizationId
      );
      await authService.forgotPassword(row.mapped.email, orgSlug);
      added += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  for (const row of updatedRows) {
    try {
      if (!row.existingId) throw new Error("missing existing record reference");
      const payload = await buildPartialPayload(row.mapped, organizationId);
      await usersService.updateUser(row.existingId, payload as never, organizationId);
      updated += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  const counts = { total: rows.length, added, updated, duplicates, invalid };

  await logAction({
    req,
    action: "IMPORT",
    module: "User",
    recordLabel: `${added} added, ${updated} updated`,
    newValue: { ...counts, errors: errors.length },
  });
  await recordImportBatch({ organizationId, module: "User", userId: req.user?.id, fileName: null, counts, errors });

  ok(res, { ...counts, errors }, "Import complete");
});

export const downloadUserTemplate = asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="user-import-template.csv"');
  res.send(USER_IMPORT_TEMPLATE_COLUMNS.join(",") + "\n");
});

export const getUserImportHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await listImportBatches({
    organizationId: req.organization!._id,
    module: "User",
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  ok(res, result, "Import history");
});
