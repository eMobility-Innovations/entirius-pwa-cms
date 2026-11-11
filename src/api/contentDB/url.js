// The contentdb admin API answers only paths that end in "/": Django does not redirect a PUT or DELETE to the
// slashed address (APPEND_SLASH), it fails. The slash goes before the query string; slashes inside the path stay.
export const withTrailingSlash = (url) => {
  const [path, ...query] = String(url ?? "").split("?");
  const slashed = path.endsWith("/") ? path : `${path}/`;
  return query.length ? `${slashed}?${query.join("?")}` : slashed;
};
