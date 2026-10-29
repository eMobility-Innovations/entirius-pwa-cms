import { defineStore } from 'pinia'
import { ref } from 'vue'
import Cookies from 'universal-cookie'
import { User } from '@/configs/access'
import { PATCH_UserProfile, POST_Logout } from '@/api/contentDB/api'
import { endRefreshSession, refreshAccessToken, SessionEndedError } from '@/api/createClient'
import { setLang, getLang } from '@/i18n'
import { expiresSoon, refreshDelay } from '@/utils/jwt'
import { hintsOn } from '@/composables/fieldHints'

// Upper bound for the whole logout (refresh + blacklist); the local logout always happens within it.
const LOGOUT_BUDGET_MS = 6000

const cookies = new Cookies()
// Never sent on a request from another site; on an https page never over plain http (local http development works).
const cookieOpts = () => ({
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
  sameSite: 'strict',
  secure: window.location.protocol === 'https:',
})

let sessionTimer = null

export const useUserStore = defineStore('user', () => {
  const user = ref(null)
  const token = ref(null)
  const refresh = ref(null)
  const customer_id = ref(null)
  const expiryDate = ref(null)
  const isAuth = ref(false)
  const isSidebarCollapsed = ref(false)
  const theme = ref('default')
  const lang = ref(getLang())
  const preferences = ref({})
  // Field hints on/off: the store is the writer of the shared state the boots read (src/composables/fieldHints.js).
  const hints = hintsOn
  let logoutRun = null

  function setStateViaCookies(cookiesKeys) {
    const stateMap = { user, token, refresh, customer_id, expiryDate, isAuth }
    cookiesKeys.forEach((key) => {
      if (stateMap[key]) {
        stateMap[key].value = cookies.get(key)
      }
    })
  }

  function setUser({ username = '', first_name = '', last_name = '', email = '', permissions = [] }) {
    user.value = new User({ username, first_name, last_name, email, buildTypes: permissions })
    cookies.set('user', user.value, cookieOpts())
  }

  // A token refresh carries no customer id (absent or null): the current one stays (the store's, else the cookie's),
  // and an unknown one is null, never written.
  function setAuth({ token: t, refresh: r, customer_id: passed, expiryDate: exp }) {
    const cid = passed ?? customer_id.value ?? cookies.get('customer_id') ?? null
    token.value = t
    refresh.value = r
    customer_id.value = cid
    expiryDate.value = exp

    cookies.set('token', t, cookieOpts())
    cookies.set('refresh', r, cookieOpts())
    if (cid != null) cookies.set('customer_id', cid, cookieOpts())
    cookies.set('expiryDate', exp, cookieOpts())

    startSessionMonitor()
  }

  // The login flow calls this last: the app leaves the login wall only with the user already in the store.
  function markAuthenticated() {
    isAuth.value = true
    cookies.set('isAuth', true, cookieOpts())
  }

  function clearAuth() {
    endRefreshSession()
    stopSessionMonitor()

    user.value = null
    token.value = null
    customer_id.value = null
    refresh.value = null
    expiryDate.value = null
    isAuth.value = false
    hints.value = true
    localStorage.removeItem('cms_hints')

    const allCookies = cookies.getAll()
    Object.keys(allCookies).forEach((cookieName) => {
      cookies.remove(cookieName, { path: '/' })
    })
  }

  // The only logout. An expiring access token is refreshed first, while the session is still current; then the
  // session ends before the server is told, so no refresh can start or land after it. A failed or timed-out
  // blacklist still logs the user out, and the full reload drops every store, pending request and timer.
  // A second call while one runs gets the running one.
  function logout() {
    if (!logoutRun) logoutRun = endSession()
    return logoutRun
  }

  async function endSession() {
    stopSessionMonitor()
    const tellServer = (async () => {
      if (refresh.value && expiresSoon(expiryDate.value)) await refreshAccessToken().catch(() => {})
      endRefreshSession()
      await POST_Logout({ access: token.value, refresh: refresh.value }).catch(() => {})
    })()
    // Nothing on the network may keep the user logged in: past the budget the session ends locally regardless
    // (a stalled refresh has no timeout of its own).
    await Promise.race([tellServer, new Promise((resolve) => setTimeout(resolve, LOGOUT_BUDGET_MS))])
    endRefreshSession()
    clearAuth()
    window.location.assign('/')
  }

  function sessionExpiredLogout() {
    stopSessionMonitor()
    // a first visit holds no token — it never hears that a session expired
    if (token.value || cookies.get('token')) localStorage.setItem('session_expired', '1')
    localStorage.setItem('cms_return_route', window.location.pathname + window.location.search)
    clearAuth()
    window.location.href = '/'
  }

  async function proactiveRefresh() {
    try {
      await refreshAccessToken()
    } catch (error) {
      if (!(error instanceof SessionEndedError)) sessionExpiredLogout()
    }
  }

  // Scheduled from the expiry the access token carried (`tokenExpiry`); every refresh re-arms it through `setAuth`.
  function startSessionMonitor() {
    stopSessionMonitor()

    const delay = refreshDelay(cookies.get('expiryDate'))
    if (delay === null) return

    sessionTimer = setTimeout(proactiveRefresh, delay)
  }

  function stopSessionMonitor() {
    if (sessionTimer) {
      clearTimeout(sessionTimer)
      sessionTimer = null
    }
  }

  function toggleSidebar() {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
    localStorage.setItem('cms_sidebar_collapsed', isSidebarCollapsed.value)
    if (isAuth.value) {
      savePreference('cms_sidebar_collapsed', isSidebarCollapsed.value)
    }
  }

  function setLanguage(l, persist = true) {
    const normalized = l.toUpperCase()
    lang.value = normalized
    setLang(normalized)
    localStorage.setItem('cms_lang', normalized)
    if (persist && isAuth.value) {
      savePreference('cms_lang', normalized)
    }
  }

  function setTheme(t, persist = true) {
    theme.value = t
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('cms_theme', t)
    if (persist && isAuth.value) {
      savePreference('cms_theme', t)
    }
  }

  function setHints(on, persist = true) {
    hints.value = on
    localStorage.setItem('cms_hints', String(on))
    if (persist && isAuth.value) {
      savePreference('cms_hints', on)
    }
  }

  function loadPreferences(extra) {
    // `extra` null: the profile call failed — the stored hints choice stands. A profile applies its own choice; one
    // without it gets hints on, never the last user's.
    if (extra && typeof extra === 'object') {
      setHints(extra.cms_hints !== false, false)
      preferences.value = { ...extra }
      if (extra.cms_theme) {
        setTheme(extra.cms_theme, false)
      }
      if (extra.cms_lang) {
        setLanguage(extra.cms_lang, false)
      }
      if (extra.cms_sidebar_collapsed !== undefined) {
        isSidebarCollapsed.value = extra.cms_sidebar_collapsed
        localStorage.setItem('cms_sidebar_collapsed', extra.cms_sidebar_collapsed)
      }
    }
  }

  async function savePreference(key, value) {
    preferences.value[key] = value
    const cid = customer_id.value
    if (!cid) return
    try {
      await PATCH_UserProfile({ uid: cid, payload: { extra: { [key]: value } } })
    } catch {
      // Silently fail — preference will be saved next time
    }
  }

  function readCookies() {
    const allCookies = cookies.getAll()
    const cookiesKeys = Object.keys(allCookies)
    if (cookiesKeys.length) {
      setStateViaCookies(cookiesKeys)

      // Reconstruct User instance from deserialized plain object
      if (user.value && !(user.value instanceof User)) {
        const u = user.value
        user.value = new User({
          username: u.username,
          first_name: u.first_name,
          last_name: u.last_name,
          email: u.email,
          buildTypes: u.buildTypes || [],
        })
      }
    }
  }

  function appInit() {
    readCookies()

    const savedTheme = localStorage.getItem('cms_theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const t = savedTheme || (prefersDark ? 'dark' : 'default')
    setTheme(t, false)

    const savedLang = localStorage.getItem('cms_lang')
    if (savedLang) setLanguage(savedLang, false)

    const savedHints = localStorage.getItem('cms_hints')
    if (savedHints !== null) setHints(savedHints !== 'false', false)

    const savedSidebar = localStorage.getItem('cms_sidebar_collapsed')
    if (savedSidebar !== null) isSidebarCollapsed.value = savedSidebar === 'true'

    // Start session monitor if authenticated
    if (isAuth.value) {
      startSessionMonitor()
    }
  }

  return {
    user, token, refresh, customer_id, expiryDate, isAuth,
    isSidebarCollapsed, theme, lang, preferences, hints,
    setAuth, markAuthenticated, clearAuth, logout, setUser, toggleSidebar, setTheme, setHints,
    setLanguage, loadPreferences, savePreference,
    readCookies, appInit, sessionExpiredLogout
  }
})
