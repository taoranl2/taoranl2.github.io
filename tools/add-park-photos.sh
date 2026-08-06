#!/bin/zsh
#
# Prepare park photos for the map on /miscellaneous/.
#
#   tools/add-park-photos.sh <slug> <photo> [photo ...]
#
# e.g.  tools/add-park-photos.sh glacier ~/Pictures/glacier/*.jpg
#
# Writes two web-sized copies of each photo into images/parks/ — a thumbnail
# for the tooltip and a larger one for the lightbox — and prints the YAML block
# to paste into _data/parks.yml. Originals are never touched.
#
# Camera and phone originals are 3-8 MB each; committing those would bloat the
# repository and make the page crawl. These come out around 25 KB and 250 KB.
#
# Uses sips, which ships with macOS. No installs.

set -e

if [[ $# -lt 2 ]]; then
  echo "usage: tools/add-park-photos.sh <slug> <photo> [photo ...]" >&2
  echo "  slug: short name for the park, e.g. glacier, rocky-mountain" >&2
  exit 1
fi

SLUG="$1"; shift

REPO="${0:A:h:h}"
OUT="$REPO/images/parks"
mkdir -p "$OUT"

THUMB_EDGE=360     # px on the long edge — displayed at ~62px, so this stays sharp on retina
FULL_EDGE=1600     # px on the long edge for the lightbox
QUALITY=72         # sips JPEG quality, 0-100

i=0
echo ""
echo "  photos:"

for src in "$@"; do
  if [[ ! -f "$src" ]]; then
    echo "skipping missing file: $src" >&2
    continue
  fi
  i=$((i + 1))
  n=$(printf "%02d" $i)

  full="$OUT/$SLUG-$n.jpg"
  thumb="$OUT/$SLUG-$n-thumb.jpg"

  sips -s format jpeg -s formatOptions $QUALITY -Z $FULL_EDGE  "$src" --out "$full"  >/dev/null
  sips -s format jpeg -s formatOptions $QUALITY -Z $THUMB_EDGE "$src" --out "$thumb" >/dev/null

  echo "    - src: /images/parks/$SLUG-$n.jpg"
  echo "      thumb: /images/parks/$SLUG-$n-thumb.jpg"
  echo "      alt: \"TODO describe this photo\""
done

echo ""
echo "--- $i photo(s) written to images/parks/ ---" >&2
du -sh "$OUT" >&2
echo "Paste the block above under the park's entry in _data/parks.yml," >&2
echo "and replace each TODO with a short description of the photo." >&2
