import Cookies from "universal-cookie";
import { createApiClient } from "@/api/createClient";

const cookies = new Cookies();

export const reviewsApi = createApiClient(process.env.VUE_APP_API_URL, {
  authHeaderFn: () => {
    const token = cookies.get("token");
    return token ? `Bearer ${token}` : null;
  },
  tokenRefresh: true,
});
