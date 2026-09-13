import { GET_User, GET_UserDetails } from "@/api/contentDB/api"
import { useUserStore } from "@/stores/user"
import { useMuninStore } from "@/stores/munin"

// Access tokens are short-lived; the user store refreshes 2 minutes before this.
const SESSION_MINUTES = 15
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

  async function completeLogin({ access, refresh, customer_id = null }) {
    const expiryDate = new Date(Date.now() + SESSION_MINUTES * 60 * 1000)
    userStore.setAuth({ token: access, refresh, customer_id, expiryDate })

    const permissions = await fetchContentPermissions()
    const { extra = null, ...profile } = await fetchProfile(customer_id)
    userStore.loadPreferences(extra)
    userStore.setUser({ ...profile, permissions: permissions.map(toBuildType) })

    await munin.fetchModules()
  }

  return { completeLogin }
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
    const { username = "", first_name = "", last_name = "", email = "", extra = null } = data?.data || {}
    return { username, first_name, last_name, email, extra }
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
