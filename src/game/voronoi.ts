export interface Point2D {
  x: number;
  y: number;
}

export interface VoronoiCellData {
  id: number;
  seed: Point2D;
  vertices: Point2D[];
  centroid: Point2D;
  neighbors: number[];
  pathD: string;
  area: number;
}

export interface VoronoiMapData {
  width: number;
  height: number;
  scale: number;
  boundary: Point2D[];
  boundaryPathD: string;
  cells: VoronoiCellData[];
  viewBox: string;
}

/** Deterministic PRNG (Mulberry32) */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jaggedEdge(
  p1: Point2D,
  p2: Point2D,
  nPoints: number,
  strength: number,
  seed: number
): Point2D[] {
  const rng = createRng(seed);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const edgeLen = Math.hypot(dx, dy);
  const nx = -dy / edgeLen;
  const ny = dx / edgeLen;

  const points: Point2D[] = [{ x: p1.x, y: p1.y }];
  for (let i = 1; i <= nPoints; i++) {
    const t = i / (nPoints + 1);
    const bx = p1.x + dx * t;
    const by = p1.y + dy * t;
    const offset = (rng() * 2 - 1) * strength * edgeLen;
    points.push({
      x: bx + nx * offset,
      y: by + ny * offset,
    });
  }
  points.push({ x: p2.x, y: p2.y });
  return points;
}

/**
 * Builds the jagged bounding polygon matching four_colors_game.py:
 * top & bottom gently jagged (strength 0.012), left & right strongly jagged (strength 0.07).
 * Ordered counter-clockwise.
 */
export function buildBoundingShape(
  width: number,
  height: number,
  seed: number
): Point2D[] {
  const bl: Point2D = { x: 0, y: 0 };
  const br: Point2D = { x: width, y: 0 };
  const tr: Point2D = { x: width, y: height };
  const tl: Point2D = { x: 0, y: height };

  const bottom = jaggedEdge(bl, br, 14, 0.012, seed);
  const right = jaggedEdge(br, tr, 18, 0.07, seed + 1);
  const top = jaggedEdge(tr, tl, 14, 0.012, seed + 2);
  const left = jaggedEdge(tl, bl, 18, 0.07, seed + 3);

  return [
    ...bottom.slice(0, -1),
    ...right.slice(0, -1),
    ...top.slice(0, -1),
    ...left.slice(0, -1),
  ];
}

function pointInPolygon(x: number, y: number, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-15) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function randomPointsInPolygon(
  polygon: Point2D[],
  nPoints: number,
  seed: number
): Point2D[] {
  const rng = createRng(seed + 101);
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;

  for (const p of polygon) {
    if (p.x < xmin) xmin = p.x;
    if (p.x > xmax) xmax = p.x;
    if (p.y < ymin) ymin = p.y;
    if (p.y > ymax) ymax = p.y;
  }

  const points: Point2D[] = [];
  let attempts = 0;
  const maxAttempts = nPoints * 40;

  while (points.length < nPoints && attempts < maxAttempts) {
    attempts++;
    const x = xmin + rng() * (xmax - xmin);
    const y = ymin + rng() * (ymax - ymin);
    if (pointInPolygon(x, y, polygon)) {
      points.push({ x, y });
    }
  }
  return points;
}

interface ClipVertex {
  x: number;
  y: number;
  /** Site id whose perpendicular bisector generated the outgoing edge from this vertex, or null for boundary edge */
  edgeOwner: number | null;
}

/**
 * Clips a simple polygon against the half-plane:
 * (p - mid) . normal <= 0
 * Preserves edge ownership so we can accurately determine geometric Voronoi neighbors.
 */
function clipPolygonWithHalfPlane(
  vertices: ClipVertex[],
  midX: number,
  midY: number,
  nx: number,
  ny: number,
  siteId: number
): ClipVertex[] {
  const n = vertices.length;
  if (n < 3) return [];

  const evalSigned = (v: ClipVertex) =>
    (v.x - midX) * nx + (v.y - midY) * ny;

  const eps = 1e-9;
  const out: ClipVertex[] = [];

  for (let i = 0; i < n; i++) {
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];
    const dCurr = evalSigned(curr);
    const dNext = evalSigned(next);
    const currIn = dCurr <= eps;
    const nextIn = dNext <= eps;

    if (currIn && nextIn) {
      out.push(next);
    } else if (currIn && !nextIn) {
      const denom = dCurr - dNext;
      const t = Math.abs(denom) < 1e-12 ? 0.5 : dCurr / denom;
      const ix = curr.x + t * (next.x - curr.x);
      const iy = curr.y + t * (next.y - curr.y);
      // Outgoing edge from intersection travels along the new clip line owned by siteId
      out.push({ x: ix, y: iy, edgeOwner: siteId });
    } else if (!currIn && nextIn) {
      const denom = dCurr - dNext;
      const t = Math.abs(denom) < 1e-12 ? 0.5 : dCurr / denom;
      const ix = curr.x + t * (next.x - curr.x);
      const iy = curr.y + t * (next.y - curr.y);
      // Outgoing edge from intersection continues along curr->next, so its owner is curr.edgeOwner
      out.push({ x: ix, y: iy, edgeOwner: curr.edgeOwner });
      out.push(next);
    }
  }

  return out;
}

function polygonArea(pts: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) * 0.5;
}

function polygonCentroid(pts: Point2D[]): Point2D {
  let cx = 0;
  let cy = 0;
  let signedArea = 0;
  for (let i = 0; i < pts.length; i++) {
    const x0 = pts[i].x;
    const y0 = pts[i].y;
    const x1 = pts[(i + 1) % pts.length].x;
    const y1 = pts[(i + 1) % pts.length].y;
    const cross = x0 * y1 - x1 * y0;
    signedArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-8) {
    const sx = pts.reduce((acc, p) => acc + p.x, 0);
    const sy = pts.reduce((acc, p) => acc + p.y, 0);
    return { x: sx / pts.length, y: sy / pts.length };
  }
  return {
    x: cx / (6 * signedArea),
    y: cy / (6 * signedArea),
  };
}

function toSvgPath(pts: Point2D[], scale: number): string {
  if (pts.length === 0) return '';
  const parts = pts.map(
    (p, idx) =>
      `${idx === 0 ? 'M' : 'L'} ${(p.x * scale).toFixed(2)} ${(
        p.y * scale
      ).toFixed(2)}`
  );
  return `${parts.join(' ')} Z`;
}

export function generateVoronoiMap(
  numCells = 200,
  seed = Math.floor(Math.random() * 100000) + 1
): VoronoiMapData {
  const width = 16.0;
  const height = 9.0;
  const scale = 100;

  const boundary = buildBoundingShape(width, height, seed);
  const seeds = randomPointsInPolygon(boundary, numCells, seed);

  // Convert boundary into initial ClipVertex template (edge i goes from vertex i to vertex i+1)
  const boundaryClipTemplate: ClipVertex[] = boundary.map((p) => ({
    x: p.x,
    y: p.y,
    edgeOwner: null,
  }));

  const rawCells: Array<{
    id: number;
    seed: Point2D;
    clipped: ClipVertex[];
    area: number;
  }> = [];

  for (let i = 0; i < seeds.length; i++) {
    const si = seeds[i];

    // Sort other seeds by squared distance from si for early termination
    const others: Array<{ j: number; distSq: number }> = [];
    for (let j = 0; j < seeds.length; j++) {
      if (i === j) continue;
      const dx = seeds[j].x - si.x;
      const dy = seeds[j].y - si.y;
      others.push({ j, distSq: dx * dx + dy * dy });
    }
    others.sort((a, b) => a.distSq - b.distSq);

    let poly = boundaryClipTemplate.slice();

    for (const other of others) {
      if (poly.length < 3) break;

      // Early exit: if half-plane is further than the furthest vertex of current poly
      let maxVertexDistSq = 0;
      for (const v of poly) {
        const vx = v.x - si.x;
        const vy = v.y - si.y;
        const dSq = vx * vx + vy * vy;
        if (dSq > maxVertexDistSq) maxVertexDistSq = dSq;
      }
      if (other.distSq > 4 * maxVertexDistSq + 1e-6) {
        break;
      }

      const sj = seeds[other.j];
      const midX = (si.x + sj.x) * 0.5;
      const midY = (si.y + sj.y) * 0.5;
      const nx = sj.x - si.x;
      const ny = sj.y - si.y;

      poly = clipPolygonWithHalfPlane(poly, midX, midY, nx, ny, other.j);
    }

    if (poly.length >= 3) {
      const pts = poly.map((v) => ({ x: v.x, y: v.y }));
      const area = polygonArea(pts);
      if (area > 1e-5) {
        rawCells.push({
          id: i,
          seed: si,
          clipped: poly,
          area,
        });
      }
    }
  }

  const validIds = new Set(rawCells.map((c) => c.id));
  const neighborMap = new Map<number, Set<number>>();
  for (const c of rawCells) {
    neighborMap.set(c.id, new Set<number>());
  }

  for (const c of rawCells) {
    const n = c.clipped.length;
    for (let k = 0; k < n; k++) {
      const vA = c.clipped[k];
      const vB = c.clipped[(k + 1) % n];
      const segLen = Math.hypot(vB.x - vA.x, vB.y - vA.y);
      // In our clip loop, when vA -> vB is generated by siteId, vA.edgeOwner stores that siteId
      if (segLen > 1e-4 && vA.edgeOwner !== null && validIds.has(vA.edgeOwner)) {
        neighborMap.get(c.id)!.add(vA.edgeOwner);
        neighborMap.get(vA.edgeOwner)!.add(c.id);
      }
    }
  }

  const cells: VoronoiCellData[] = rawCells.map((c) => {
    const pts = c.clipped.map((v) => ({ x: v.x, y: v.y }));
    const scaledCentroid = polygonCentroid(pts);
    return {
      id: c.id,
      seed: { x: c.seed.x * scale, y: c.seed.y * scale },
      vertices: pts,
      centroid: {
        x: scaledCentroid.x * scale,
        y: scaledCentroid.y * scale,
      },
      neighbors: Array.from(neighborMap.get(c.id) ?? []),
      pathD: toSvgPath(pts, scale),
      area: c.area,
    };
  });

  // Compute tight viewBox around jagged boundary with small padding
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of boundary) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const pad = 28;
  const vbX = Math.floor(minX * scale - pad);
  const vbY = Math.floor(minY * scale - pad);
  const vbW = Math.ceil((maxX - minX) * scale + pad * 2);
  const vbH = Math.ceil((maxY - minY) * scale + pad * 2);

  return {
    width,
    height,
    scale,
    boundary,
    boundaryPathD: toSvgPath(boundary, scale),
    cells,
    viewBox: `${vbX} ${vbY} ${vbW} ${vbH}`,
  };
}
