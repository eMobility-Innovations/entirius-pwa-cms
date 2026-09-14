import { isAccessPanelEnabled, ACCESS_PANEL_IDX } from "@/configs/accessMatrix";

/**
 * The access-matrix panel's routes, or nothing at all.
 *
 * Returned from a FUNCTION, like `ssoRoutes` beside it, so the flag decides whether these
 * paths EXIST rather than merely whether they render: with the panel off the router has
 * never heard of /access/, and a bundle built for a deployment without the backend cannot
 * route to it by accident.
 *
 * Every route is additionally gated at run time — the panel entry is only shown to
 * somebody the matrix grants `page:access`, and the views check again.
 */
export function accessRoutes() {
  if (!isAccessPanelEnabled()) return [];

  return [
    {
      path: "/access/grants",
      name: "AccessGrants",
      component: () => import(/* webpackChunkName: "access" */ "../views/Access/Grants.vue"),
      meta: { requiresAuth: true, titleKey: "access.grants", panel: ACCESS_PANEL_IDX },
    },
    {
      path: "/access/roles",
      name: "AccessRoles",
      component: () => import(/* webpackChunkName: "access" */ "../views/Access/RoleMatrix.vue"),
      meta: { requiresAuth: true, titleKey: "access.roles", panel: ACCESS_PANEL_IDX },
    },
    {
      path: "/access/users",
      name: "AccessUsers",
      component: () => import(/* webpackChunkName: "access" */ "../views/Access/UserOverrides.vue"),
      meta: { requiresAuth: true, titleKey: "access.users", panel: ACCESS_PANEL_IDX },
    },
    {
      path: "/access/audit",
      name: "AccessAudit",
      component: () => import(/* webpackChunkName: "access" */ "../views/Access/AuditLog.vue"),
      meta: { requiresAuth: true, titleKey: "access.audit", panel: ACCESS_PANEL_IDX },
    },
    {
      path: "/access/service-accounts",
      name: "AccessServiceAccounts",
      component: () =>
        import(/* webpackChunkName: "access" */ "../views/Access/ServiceAccounts.vue"),
      meta: { requiresAuth: true, titleKey: "access.service_accounts", panel: ACCESS_PANEL_IDX },
    },
  ];
}
