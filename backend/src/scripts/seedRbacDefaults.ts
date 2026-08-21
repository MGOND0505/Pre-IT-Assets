import { Permission } from "../models/Permission";
import { Role } from "../models/Role";
import { PERMISSION_CATALOG, DEFAULT_ROLE_GRANTS } from "../config/permissionCatalog";
import { logger } from "../utils/logger";

/**
 * Idempotent RBAC bootstrap, safe to call on every server start:
 * - Permission catalog rows are upserted by key (new modules/actions added over time just appear).
 * - The 5 default roles are only created if the `roles` collection is completely empty,
 *   so any later admin edits to role permissions are never overwritten.
 */
export async function ensureRbacDefaults(): Promise<void> {
  for (const def of PERMISSION_CATALOG) {
    await Permission.findOneAndUpdate(
      { key: def.key },
      { module: def.module, action: def.action, description: def.description },
      { upsert: true }
    );
  }

  const roleCount = await Role.countDocuments();
  if (roleCount > 0) return;

  const allPermissionIds = (await Permission.find().select("_id")).map((p) => p.id);

  for (const [name, def] of Object.entries(DEFAULT_ROLE_GRANTS)) {
    const permissionIds =
      def.keys === "all"
        ? allPermissionIds
        : (await Permission.find({ key: { $in: def.keys } }).select("_id")).map((p) => p.id);

    await Role.create({
      name,
      description: def.description,
      isSystem: def.isSystem,
      isSuperAdmin: def.isSuperAdmin ?? false,
      permissions: permissionIds,
    });
  }

  logger.info(`Seeded ${Object.keys(DEFAULT_ROLE_GRANTS).length} default roles`);
}
