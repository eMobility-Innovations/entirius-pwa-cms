// The image of a responsive set to draw in a media tile: the smallest source at least twice the tile width (sharp
// on a 2x screen), else the largest there is. `set` = [{ source, width, height }]; an empty set gives "" (the
// MediaTile placeholder).
const TILE_SOURCE_MIN_WIDTH = 376;

export function thumbnailOf(set = []) {
  const bySize = [...set].sort((a, b) => a.width - b.width);
  const sharp = bySize.find(({ width }) => width >= TILE_SOURCE_MIN_WIDTH);
  return (sharp || bySize.at(-1))?.source || "";
}
