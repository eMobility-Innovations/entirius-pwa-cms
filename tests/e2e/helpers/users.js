/**
 * The zeno seed's superuser (todo/access README § Contract): a dev default, never real; a run can name another.
 * The access specs log in with it explicitly: `login(page)` alone falls back to `VUE_APP_*` or `admin`/`admin`,
 * which is not the seed's password, and every wrong attempt counts toward the 10-attempt lockout of `api/token/`.
 */
const SUPERUSER = [process.env.ACCESS_SUPERUSER_USERNAME || 'admin', process.env.ACCESS_SUPERUSER_PASSWORD || 'admin123'];

module.exports = { SUPERUSER };
