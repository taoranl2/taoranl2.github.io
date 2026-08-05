#!/usr/bin/env python3
"""Generate simplified SVG paths for a US state map, projected with Albers USA.

Input : us-atlas states-10m.json (TopoJSON of US Census cartographic boundaries,
        which are public domain).
Output: _data/us_states.yml — one entry per state with its SVG path data.

The projection is a from-scratch port of d3-geo's geoAlbersUsa: a conic
equal-area projection for the lower 48, plus separately-parameterised insets
for Alaska and Hawaii, each clipped to its own box.
"""

import json
import math
import sys

RADIANS = math.pi / 180.0
TAU = 2 * math.pi

# ---------------------------------------------------------------- projection


def conic_equal_area_raw(phi0_deg, phi1_deg):
    """d3-geo conicEqualAreaRaw for two standard parallels."""
    y0 = phi0_deg * RADIANS
    y1 = phi1_deg * RADIANS
    sy0 = math.sin(y0)
    n = (sy0 + math.sin(y1)) / 2.0
    c = 1 + sy0 * (2 * n - sy0)
    r0 = math.sqrt(c) / n

    def project(lam, phi):
        r = math.sqrt(c - 2 * n * math.sin(phi)) / n
        a = lam * n
        return (r * math.sin(a), r0 - r * math.cos(a))

    return project


class Albers:
    """One conic-equal-area sub-projection: rotate, project, scale, translate."""

    def __init__(self, parallels, rotate_lon, center, scale, translate):
        self.raw = conic_equal_area_raw(*parallels)
        self.delta_lambda = rotate_lon * RADIANS
        self.k = scale
        # d3 applies `center` in post-rotation coordinates, so it is fed to the
        # raw projection directly rather than being rotated first.
        cx, cy = self.raw(center[0] * RADIANS, center[1] * RADIANS)
        self.dx = translate[0] - self.k * cx
        self.dy = translate[1] + self.k * cy

    def __call__(self, lon, lat):
        lam = lon * RADIANS + self.delta_lambda
        if lam > math.pi:
            lam -= TAU
        elif lam < -math.pi:
            lam += TAU
        x, y = self.raw(lam, lat * RADIANS)
        return (self.dx + self.k * x, self.dy - self.k * y)


def albers_usa(scale=1070.0, translate=(480.0, 250.0)):
    """Returns (lower48, alaska, hawaii) as (projection, clip_box) pairs.

    Constants are d3-geo's; clip boxes are what keep each inset in its corner.
    """
    k = scale
    x, y = translate

    lower48 = Albers([29.5, 45.5], 96, (-0.6, 38.7), k, (x, y))
    lower48_clip = (x - 0.455 * k, y - 0.238 * k, x + 0.455 * k, y + 0.238 * k)

    alaska = Albers([55, 65], 154, (-2, 58.5), k * 0.35,
                    (x - 0.307 * k, y + 0.201 * k))
    alaska_clip = (x - 0.425 * k, y + 0.120 * k, x - 0.214 * k, y + 0.234 * k)

    hawaii = Albers([8, 18], 157, (-3, 19.9), k,
                    (x - 0.205 * k, y + 0.212 * k))
    hawaii_clip = (x - 0.214 * k, y + 0.166 * k, x - 0.115 * k, y + 0.234 * k)

    return {
        "lower48": (lower48, lower48_clip),
        "alaska": (alaska, alaska_clip),
        "hawaii": (hawaii, hawaii_clip),
    }


# ------------------------------------------------------------------ topojson


def decode_arcs(topology):
    """Undo TopoJSON delta encoding and quantisation into absolute lon/lat."""
    sx, sy = topology["transform"]["scale"]
    tx, ty = topology["transform"]["translate"]
    out = []
    for arc in topology["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * sx + tx, y * sy + ty))
        out.append(points)
    return out


def ring_coords(arcs, indices):
    """Stitch a ring together from (possibly reversed) arc indices."""
    points = []
    for i in indices:
        if i < 0:
            arc = arcs[~i][::-1]
        else:
            arc = arcs[i]
        # Consecutive arcs share an endpoint; drop the duplicate.
        points.extend(arc[1:] if points else arc)
    return points


def polygons(geometry, arcs):
    """Yield every ring of a Polygon/MultiPolygon as a list of lon/lat pairs."""
    if geometry["type"] == "Polygon":
        rings = [geometry["arcs"]]
    elif geometry["type"] == "MultiPolygon":
        rings = geometry["arcs"]
    else:
        return
    for polygon in rings:
        for ring in polygon:
            yield ring_coords(arcs, ring)


# ------------------------------------------------------------------ clipping


def clip_to_box(points, box):
    """Sutherland-Hodgman clip of a closed ring against an axis-aligned box."""
    x0, y0, x1, y1 = box

    def clip_edge(pts, inside, intersect):
        if not pts:
            return []
        out = []
        prev = pts[-1]
        prev_in = inside(prev)
        for cur in pts:
            cur_in = inside(cur)
            if cur_in:
                if not prev_in:
                    out.append(intersect(prev, cur))
                out.append(cur)
            elif prev_in:
                out.append(intersect(prev, cur))
            prev, prev_in = cur, cur_in
        return out

    def lerp_x(a, b, xc):
        t = (xc - a[0]) / (b[0] - a[0])
        return (xc, a[1] + t * (b[1] - a[1]))

    def lerp_y(a, b, yc):
        t = (yc - a[1]) / (b[1] - a[1])
        return (a[0] + t * (b[0] - a[0]), yc)

    pts = points
    pts = clip_edge(pts, lambda p: p[0] >= x0, lambda a, b: lerp_x(a, b, x0))
    pts = clip_edge(pts, lambda p: p[0] <= x1, lambda a, b: lerp_x(a, b, x1))
    pts = clip_edge(pts, lambda p: p[1] >= y0, lambda a, b: lerp_y(a, b, y0))
    pts = clip_edge(pts, lambda p: p[1] <= y1, lambda a, b: lerp_y(a, b, y1))
    return pts


# -------------------------------------------------------------- simplifying


def simplify(points, tolerance):
    """Douglas-Peucker, iterative so deep rings can't blow the stack."""
    if len(points) < 3:
        return points

    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]

    while stack:
        first, last = stack.pop()
        if last <= first + 1:
            continue
        ax, ay = points[first]
        bx, by = points[last]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy)

        worst = 0.0
        index = -1
        for i in range(first + 1, last):
            px, py = points[i]
            if norm == 0:
                dist = math.hypot(px - ax, py - ay)
            else:
                dist = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if dist > worst:
                worst, index = dist, i

        if worst > tolerance and index != -1:
            keep[index] = True
            stack.append((first, index))
            stack.append((index, last))

    return [p for p, k in zip(points, keep) if k]


def signed_area(points):
    total = 0.0
    for i in range(len(points)):
        x0, y0 = points[i]
        x1, y1 = points[(i + 1) % len(points)]
        total += x0 * y1 - x1 * y0
    return total / 2.0


# ---------------------------------------------------------------- emitting


def to_path(rings, precision=1):
    parts = []
    for ring in rings:
        if len(ring) < 3:
            continue
        chunks = []
        for x, y in ring:
            chunks.append("%s,%s" % (round(x, precision), round(y, precision)))
        parts.append("M" + "L".join(chunks) + "Z")
    return "".join(parts)


# Territories outside the composite projection.
SKIP_FIPS = {"60", "66", "69", "72", "78"}
ALASKA_FIPS = "02"
HAWAII_FIPS = "15"

# Rings smaller than this (in projected px²) are dropped: barrier islands and
# specks that only add bytes at this size.
MIN_AREA = 1.2


def main():
    src, dest = sys.argv[1], sys.argv[2]
    tolerance = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6

    topology = json.load(open(src))
    arcs = decode_arcs(topology)
    projections = albers_usa()

    rows = []
    bounds = [math.inf, math.inf, -math.inf, -math.inf]

    for geometry in topology["objects"]["states"]["geometries"]:
        fips = geometry["id"]
        if fips in SKIP_FIPS:
            continue
        name = geometry["properties"]["name"]

        if fips == ALASKA_FIPS:
            projection, clip = projections["alaska"]
        elif fips == HAWAII_FIPS:
            projection, clip = projections["hawaii"]
        else:
            projection, clip = projections["lower48"]

        rings = []
        for lonlat in polygons(geometry, arcs):
            ring = [projection(lon, lat) for lon, lat in lonlat]
            ring = clip_to_box(ring, clip)
            if len(ring) < 3:
                continue
            if abs(signed_area(ring)) < MIN_AREA:
                continue
            ring = simplify(ring, tolerance)
            if len(ring) < 3:
                continue
            rings.append(ring)
            for x, y in ring:
                bounds[0] = min(bounds[0], x)
                bounds[1] = min(bounds[1], y)
                bounds[2] = max(bounds[2], x)
                bounds[3] = max(bounds[3], y)

        if not rings:
            continue
        rows.append((name, fips, to_path(rings)))

    rows.sort(key=lambda r: r[0])

    with open(dest, "w") as fh:
        fh.write(
            "# US state outlines for the map on /miscellaneous/.\n"
            "#\n"
            "# GENERATED FILE — do not hand-edit.\n"
            "# Source: us-atlas states-10m.json, which repackages US Census\n"
            "# cartographic boundary files (public domain).\n"
            "# Projection: Albers USA (lower 48 conic equal-area, with Alaska and\n"
            "# Hawaii as clipped insets), then Douglas-Peucker simplified.\n"
            "# Regenerate with tools/gen_us_map.py.\n"
            "#\n"
            "# viewBox: %s\n\n" % viewbox(bounds)
        )
        for name, fips, path in rows:
            fh.write('- name: "%s"\n  fips: "%s"\n  d: "%s"\n' % (name, fips, path))

    total = sum(len(p) for _, _, p in rows)
    print("states: %d" % len(rows))
    print("path bytes: %d" % total)
    print("bounds: %s" % [round(b, 1) for b in bounds])
    print("viewBox: %s" % viewbox(bounds))


def viewbox(bounds, pad=6):
    x0, y0, x1, y1 = bounds
    return "%.0f %.0f %.0f %.0f" % (
        x0 - pad, y0 - pad, (x1 - x0) + 2 * pad, (y1 - y0) + 2 * pad)


if __name__ == "__main__":
    main()
