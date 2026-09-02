import { CustomFieldDefinition, type CustomFieldModule } from "../../models/CustomFieldDefinition";
import { ApiError } from "../../utils/ApiError";

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

// Every route accepting these values defers ALL validation to this function (see the module doc
// comment below) - without a cap here, a "text" custom field had no length limit at all, unlike
// every other free-text field in this app, letting a caller store an arbitrarily large string per
// field on every asset/license/ticket write (storage-exhaustion risk, and oversized documents).
const MAX_TEXT_FIELD_LENGTH = 2000;

/**
 * The real authorization/correctness boundary for custom field values - runs server-side on every
 * create/update for assets/licenses/helpdesk (never trust the frontend to have enforced this).
 *
 * Loads the module's currently-Active definitions and, for each one, enforces required-ness and
 * coerces/validates the incoming raw value by `type`. Any key in `rawValues` that doesn't match an
 * active definition is silently dropped - this keeps stale/renamed-away keys from accumulating
 * garbage. Only keys that had a value in `rawValues` are returned, so callers merge the result onto
 * the record's existing `customFields` map (`{...doc.customFields, ...delta}`) rather than replace
 * it wholesale - a request that doesn't mention a given field leaves its previously-stored value
 * (even one belonging to a now-Inactive definition) untouched.
 */
export async function validateCustomFieldValues(
  rawValues: unknown,
  module: CustomFieldModule,
  organizationId: string,
  // Only meaningful for module "assets" - when provided, category-scoped definitions for OTHER
  // categories are excluded (so a Laptop's write never has to satisfy Mobile's required "IMEI").
  // Module-wide (category: null) definitions always apply regardless of this param.
  categoryId?: string | null
): Promise<Record<string, unknown>> {
  const input = (rawValues && typeof rawValues === "object" ? (rawValues as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;

  const definitions = await CustomFieldDefinition.find({
    organization: organizationId,
    module,
    status: "Active",
    isDeleted: false,
    category: categoryId ? { $in: [null, categoryId] } : null,
  });

  const result: Record<string, unknown> = {};

  for (const def of definitions) {
    const hasValue = Object.prototype.hasOwnProperty.call(input, def.key);
    const raw = input[def.key];

    if (def.required && isEmpty(hasValue ? raw : undefined)) {
      throw new ApiError(400, `"${def.label}" is required`);
    }

    if (!hasValue || isEmpty(raw)) continue;

    switch (def.type) {
      case "text": {
        const text = String(raw);
        if (text.length > MAX_TEXT_FIELD_LENGTH) {
          throw new ApiError(400, `"${def.label}" must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer`);
        }
        result[def.key] = text;
        break;
      }
      case "number": {
        const num = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(num)) throw new ApiError(400, `"${def.label}" must be a number`);
        result[def.key] = num;
        break;
      }
      case "date": {
        const date = raw instanceof Date ? raw : new Date(raw as string);
        if (Number.isNaN(date.getTime())) throw new ApiError(400, `"${def.label}" must be a valid date`);
        result[def.key] = date.toISOString();
        break;
      }
      case "select": {
        if (typeof raw !== "string" || !def.options.includes(raw)) {
          throw new ApiError(400, `"${def.label}" must be one of: ${def.options.join(", ")}`);
        }
        result[def.key] = raw;
        break;
      }
      case "checkbox": {
        result[def.key] = raw === true || raw === "true" || raw === 1 || raw === "1";
        break;
      }
    }
  }

  return result;
}
