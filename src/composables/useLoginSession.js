import { useRouter } from "vue-router"
import { GET_User, GET_UserDetails } from "@/api/contentDB/api"
import { useUserStore } from "@/stores/user"
import { useMuninStore } from "@/stores/munin"
import { useAccessStore } from "@/stores/access"
import { tokenExpiry } from "@/utils/jwt"

const RETURN_ROUTE_KEY = "cms_return_route"
const LAYOUT_EXTENDERS = ["header", "footer"]

/**
 * Turns a token pair into a CMS session — shared by every login method
 * (password and SSO), so they cannot drift apart.
 *
 * Usage (Options API — setup return pattern):
 *   setup() {
 *     const { completeLogin } = useLoginSession()
 *     return { completeLogin }
 *   }
 *   // after the backend answered: await this.completeLogin({ access, refresh, customer_id })
 *
 * Profile and content permissions are optional backend modules: a failing
 * call falls back to defaults and never aborts the login.
 */
export function useLoginSession() {
  const userStore = useUserStore()
  const munin = useMuninStore()
  const accessStore = useAccessStore()
  const router = useRouter()

  async function completeLogin({ access, refresh, customer_id = null }) {
    userStore.setAuth({ token: access, refresh, customer_id, expiryDate: tokenExpiry(access) })

    const permissions = await fetchContentPermissions()
    const { extra = null, ...profile } = await fetchProfile(customer_id)
    userStore.loadPreferences(extra)
    userStore.setUser({ ...profile, permissions: permissions.map(toBuildType) })

    await munin.fetchModules()
    // After munin, which tells whether django-access is installed; a failure leaves the store in `error`.
    await accessStore.ensureLoaded()
    // A route opened before login passed the guard without the access check: guard it again for this user before the
    // shell renders it (a panel they cannot read lands on Home).
    await reguard(router)
    // Last: leaving the login wall earlier let a fast click outrun the user cookie (empty sidebar on reloads).
    userStore.markAuthenticated()
  }

  return { completeLogin }
}

function reguard(router) {
  const { path, query, hash } = router.currentRoute.value
  return router.replace({ path, query, hash, force: true })
}

/**
 * Returns the route a session-expired logout stored, and forgets it.
 * `null` when there is none or it is the home page.
 */
export function consumeReturnRoute() {
  const route = localStorage.getItem(RETURN_ROUTE_KEY)
  localStorage.removeItem(RETURN_ROUTE_KEY)
  return route && route !== "/" ? route : null
}

// Content permissions live in ContentDB (Pages panel). On stacks without
// contentdb this 404s — it must not abort login, or the left menu renders empty.
async function fetchContentPermissions() {
  try {
    const { data } = await GET_User({})
    return data?.data || []
  } catch (e) {
    console.warn("content-permissions unavailable (contentdb not installed)", e)
    return []
  }
}

async function fetchProfile(uid) {
  try {
    const { data } = await GET_UserDetails({ uid })
    const { username = "", first_name = "", last_name = "", email = "", extra } = data?.data || {}
    // A profile without `extra` is still a profile: `{}`, so its defaults apply. `null` means no profile answered.
    return { username, first_name, last_name, email, extra: extra ?? {} }
  } catch (e) {
    console.warn("Profile endpoint unavailable — using defaults", e)
    return { username: "", first_name: "", last_name: "", email: "", extra: null }
  }
}

function toBuildType(permission) {
  const isLayout = LAYOUT_EXTENDERS.includes(permission.slug)
  return {
    ...permission,
    _for: isLayout ? "layout-extender" : "content",
    _limit: isLayout ? 1 : null,
  }
}
