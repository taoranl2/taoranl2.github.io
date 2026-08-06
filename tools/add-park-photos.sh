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
QUALITY=62         # sips JPEG quality, 0-100; 62 is visually clean at these sizes

# sips -Z enlarges as well as shrinks, which would blur an already-small photo
# and waste bytes, so only resize when the source is actually bigger.
resize_to() {
  local src="$1" out="$2" target="$3"
  local w h edge
  w=$(sips -g pixelWidth  "$src" | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$src" | awk '/pixelHeight/{print $2}')
  edge=$(( w > h ? w : h ))
  if [[ $edge -gt $target ]]; then
    sips -s format jpeg -s formatOptions $QUALITY -Z $target "$src" --out "$out" >/dev/null
  else
    sips -s format jpeg -s formatOptions $QUALITY "$src" --out "$out" >/dev/null
  fi
}

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

  resize_to "$src" "$full"  $FULL_EDGE
  resize_to "$src" "$thumb" $THUMB_EDGE

  echo "    - src: /images/parks/$SLUG-$n.jpg"
  echo "      thumb: /images/parks/$SLUG-$n-thumb.jpg"
  echo "      alt: \"TODO describe this photo\""
done

echo ""
echo "--- $i photo(s) written to images/parks/ ---" >&2
du -sh "$OUT" >&2
echo "Paste the block above under the park's entry in _data/parks.yml," >&2
echo "and replace each TODO with a short description of the photo." >&2
