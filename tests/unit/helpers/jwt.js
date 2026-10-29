// An unsigned JWT issued now on the server's clock (`skewSeconds` = server minus client), living `seconds`.
export function jwtExpiringIn(seconds, skewSeconds = 0) {
  const iat = Math.floor(Date.now() / 1000) + skewSeconds;
  return `header.${btoa(JSON.stringify({ iat, exp: iat + seconds }))}.signature`;
}
