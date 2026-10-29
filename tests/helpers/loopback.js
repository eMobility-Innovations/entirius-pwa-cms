// The capture projects (tests/docs, tests/visual) sign in with real credentials, and the docs project writes for
// real. They are built for a stack on this machine: a CMS_BASE_URL or CMS_API_URL on any other host is refused
// unless CMS_ALLOW_REMOTE=1 says it is meant.
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** The URL in `process.env[name]` (or `fallback`); throws `INFRA: …` when its host is not loopback. */
function loopbackUrl(name, fallback) {
  const url = process.env[name] || fallback;
  if (process.env.CMS_ALLOW_REMOTE === "1") return url;
  const { hostname } = new URL(url);
  if (LOOPBACK_HOSTS.includes(hostname)) return url;
  throw new Error(
    `INFRA: ${name} points at ${hostname}, not at this machine. The capture projects log in and may write there; ` +
      "set CMS_ALLOW_REMOTE=1 to run against it on purpose."
  );
}

module.exports = { loopbackUrl };
