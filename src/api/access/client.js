import Cookies from "universal-cookie";
import { createApiClient } from "@/api/createClient";

const cookies = new Cookies();

// Authenticated, with the shared refresh interceptor: every call here is made by somebody
// already logged in. createClient already rejects a 403 WITHOUT logging out, which matters
// more here than anywhere else in the CMS — a refusal from the matrix is the normal answer
// for somebody who may read but not write, and it must not end their session.
export const accessApi = createApiClient(process.env.VUE_APP_API_URL, {
  authHeaderFn: () => {
    const token = cookies.get("token");
    return token ? `Bearer ${token}` : null;
  },
  tokenRefresh: true,
});
