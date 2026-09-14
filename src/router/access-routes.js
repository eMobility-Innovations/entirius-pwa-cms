import { isAccessPanelEnabled, ACCESS_PANEL_IDX } from "@/configs/accessMatrix";

/**
 * The access-matrix panel's routes, or nothing at all.
 *
 * Returned from a FUNCTION, like `ssoRoutes` beside it, so the flag decides whether these
 * paths EXIST rather than merely whether they render: with the panel off the router has
 * never heard of /access, and a bundle built for a deployment without the backend cannot
 * route to it by accident.
 *
 * EVERY view is a CHILD of the shell, never a sibling. views/Access/index.vue holds the
 * only call to the store's ensureLoaded(), the `page:access` check and the "you hold no
 * grant" page. Registered flat — as these were — the shell is on no path at all: the
 * store never loads, `canWrite` is false for everybody, and the panel renders with no
 * grant form and no revoke buttons even for a SYSADMIN. Nesting them is what puts the
 * permission check in front of the views instead of beside them.
 */
export function accessRoutes() {
  if (!isAccessPanelEnabled()) return [];

  return [
    {
      path: "/access",
      component: () => import(/* webpackChunkName: "access" */ "../views/Access/index.vue"),
      meta: { requiresAuth: true, panel: ACCESS_PANEL_IDX },
      children: [
        {
          path: "grants",
          name: "AccessGrants",
          component: () => import(/* webpackChunkName: "access" */ "../views/Access/Grants.vue"),
          meta: { requiresAuth: true, titleKey: "access.grants", panel: ACCESS_PANEL_IDX },
        },
        {
          path: "roles",
          name: "AccessRoles",
          component: () =>
            import(/* webpackChunkName: "access" */ "../views/Access/RoleMatrix.vue"),
          meta: { requiresAuth: true, titleKey: "access.roles", panel: ACCESS_PANEL_IDX },
        },
        {
          path: "users",
          name: "AccessUsers",
          component: () =>
            import(/* webpackChunkName: "access" */ "../views/Access/UserOverrides.vue"),
          meta: { requiresAuth: true, titleKey: "access.users", panel: ACCESS_PANEL_IDX },
        },
        {
          path: "audit",
          name: "AccessAudit",
          component: () => import(/* webpackChunkName: "access" */ "../views/Access/AuditLog.vue"),
          meta: { requiresAuth: true, titleKey: "access.audit", panel: ACCESS_PANEL_IDX },
        },
        {
          path: "service-accounts",
          name: "AccessServiceAccounts",
          component: () =>
            import(/* webpackChunkName: "access" */ "../views/Access/ServiceAccounts.vue"),
          meta: {
            requiresAuth: true,
            titleKey: "access.service_accounts",
            panel: ACCESS_PANEL_IDX,
          },
        },
      ],
    },
  ];
}
