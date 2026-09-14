import { SSO_CALLBACK_ROUTE, isSsoEnabled } from "@/configs/sso";

/**
 * The SSO callback route, or nothing at all.
 *
 * Returned as an array so the flag decides whether the route EXISTS, not merely whether
 * it renders: with SSO off the path is unknown to the router and falls through exactly as
 * it did before this feature was added.
 */
export function ssoRoutes() {
  if (!isSsoEnabled()) return [];

  return [
    {
      path: SSO_CALLBACK_ROUTE,
      name: "SsoCallback",
      component: () =>
        import(/* webpackChunkName: "auth" */ "../views/Sso/Callback.vue"),
      // The whole point of this route is to CREATE the session, so it cannot require one.
      // App.vue renders any route with requiresAuth === false instead of the login wall.
      meta: {
        requiresAuth: false,
      },
    },
  ];
}
