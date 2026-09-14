import { createApiClient } from '@/api/createClient'

// Deliberately NO auth header and NO token refresh. Both SSO endpoints are public —
// nobody is logged in yet — and the refresh interceptor turns any 401 into
// sessionExpiredRedirect(), which clears every cookie and reloads. A failed code
// exchange would therefore log out a user who still had a valid session in another tab,
// and the real error would never reach the screen.
export const ssoApi = createApiClient(process.env.VUE_APP_API_URL)
