import { AREAS } from "@/configs/areas";

// Mirrors django_escaccess.routes: the same permission guards the backend API.
const MODULE_FEATURE = Object.freeze({
  pim: "catalogue", enrichment: "catalogue", lookup: "catalogue",
  pricemanager: "pricing", pricefighter: "pricing", atlas: "pricing",
  qms: "quality", suppliers: "suppliers",
});
const SERVICE_MODULES = new Set(["accounts", "email", "munin"]);
const KNOWN_AREAS = new Set(Object.values(AREAS));

export function organizationPermission(area, level = "read") {
  if (!KNOWN_AREAS.has(area) || !["read", "write"].includes(level)) return null;
  if (area === AREAS.ACCESS_MANAGE) return level === "read" ? "page:access" : "feature:edit_role_mappings";
  const module = area.split(".")[0];
  if (SERVICE_MODULES.has(module)) return "feature:service_admin";
  const feature = MODULE_FEATURE[module];
  return feature ? `feature:${feature}_${level}` : null;
}

export function organizationCan(me, area, level = "read") {
  const permission = organizationPermission(area, level);
  return !!permission && Array.isArray(me?.permissions) && me.permissions.includes(permission);
}
