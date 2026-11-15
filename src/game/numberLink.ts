export type NumberLinkModeId = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

export interface NumberLinkModeConfig {
  id: NumberLinkModeId;
  name: string;
  subtitle: string;
  size: number;
  minValue: number;
  maxValue: number;
}

export const NUMBER_LINK_MODES: Record<NumberLinkModeId, NumberLinkModeConfig> = {
  EASY: {
    id: 'EASY',
    name: 'Dễ',
    subtitle: '4 × 4 · 16 ô · Số 2–50',
    size: 4,
    minValue: 2,
    maxValue: 50,
  },
  MEDIUM: {
    id: 'MEDIUM',
    name: 'Trung bình',
    subtitle: '6 × 6 · 36 ô · Số 2–100',
    size: 6,
    minValue: 2,
    maxValue: 100,
  },
  HARD: {
    id: 'HARD',
    name: 'Khó (Chuẩn)',
    subtitle: '8 × 8 · 64 ô · Số 20–500',
    size: 8,
    minValue: 20,
    maxValue: 500,
  },
  EXPERT: {
    id: 'EXPERT',
    name: 'Siêu trí tuệ',
    subtitle: '10 × 10 · 100 ô · Số 50–1000',
    size: 10,
    minValue: 50,
    maxValue: 1000,
  },
};

export const SCORE_SAME = 100;
export const SCORE_ONE_ELIMINATED = 50;
export const SCORE_GCD_NO_ELIMINATION = 10;

export interface GridCoord {
  r: number;
  c: number;
}

export type NumberGrid = (number | null)[][];

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

export function applyGcdRule(
  val1: number,
  val2: number
): {
  newVal1: number | null;
  newVal2: number | null;
  gcdVal: number;
  points: number;
} {
  if (val1 === val2) {
    return {
      newVal1: null,
      newVal2: null,
      gcdVal: val1,
      points: SCORE_SAME,
    };
  }

  const g = gcd(val1, val2);
  const q1 = Math.floor(val1 / g);
  const q2 = Math.floor(val2 / g);

  const newVal1 = q1 === 1 ? null : q1;
  const newVal2 = q2 === 1 ? null : q2;

  let points = SCORE_GCD_NO_ELIMINATION;
  if (newVal1 === null && newVal2 === null) {
    points = SCORE_SAME;
  } else if (newVal1 === null || newVal2 === null) {
    points = SCORE_ONE_ELIMINATED;
  }

  return { newVal1, newVal2, gcdVal: g, points };
}

function primeFactorization(n: number): Map<number, number> {
  const factors = new Map<number, number>();
  let rem = n;
  let d = 2;
  while (d * d <= rem) {
    while (rem % d === 0) {
      factors.set(d, (factors.get(d) ?? 0) + 1);
      rem = Math.floor(rem / d);
    }
    d++;
  }
  if (rem > 1) {
    factors.set(rem, (factors.get(rem) ?? 0) + 1);
  }
  return factors;
}

function countTotalPrimeFactors(values: number[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const num of values) {
    const factors = primeFactorization(num);
    for (const [p, cnt] of factors.entries()) {
      totals.set(p, (totals.get(p) ?? 0) + cnt);
    }
  }
  return totals;
}

function getOddPrimes(values: number[]): number[] {
  const totals = countTotalPrimeFactors(values);
  const odd: number[] = [];
  for (const [p, cnt] of totals.entries()) {
    if (cnt % 2 !== 0) odd.push(p);
  }
  return odd;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildBalancedValues(
  size: number,
  minValue: number,
  maxValue: number
): number[] {
  const totalCells = size * size;
  const maxSame = Math.max(2, Math.floor(totalCells / 4));
  const primePool = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29].filter(
    (p) => p <= Math.max(13, Math.floor(maxValue / 2))
  );

  for (let attempt = 0; attempt < 80; attempt++) {
    const values: number[] = [];
    const counts = new Map<number, number>();

    let genAttempts = 0;
    while (values.length < totalCells && genAttempts < totalCells * 8) {
      genAttempts++;
      const numPrimes = randInt(1, Math.min(3, primePool.length));
      const picked = shuffle(primePool).slice(0, numPrimes);
      let v = 1;
      for (const p of picked) {
        const power = randInt(1, 2);
        v *= p ** power;
      }

      if (v < minValue) {
        const mult = Math.floor(minValue / v) + randInt(1, 3);
        v *= mult;
      }
      while (v > maxValue && v > minValue) {
        v = Math.floor(v / (Math.random() < 0.5 ? 2 : 3));
      }
      if (v < minValue || v > maxValue) continue;
      if ((counts.get(v) ?? 0) >= maxSame) continue;

      values.push(v);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    while (values.length < totalCells) {
      const v = randInt(minValue, Math.min(minValue * 10, maxValue));
      values.push(v);
    }

    // Deterministically balance every prime factor with odd count
    let oddPrimes = getOddPrimes(values);
    let fixGuard = 0;
    while (oddPrimes.length > 0 && fixGuard < 200) {
      fixGuard++;
      const p = oddPrimes[0];
      let fixed = false;

      const indices = shuffle(
        Array.from({ length: values.length }, (_, idx) => idx)
      );
      for (const idx of indices) {
        const v = values[idx];
        if (v * p <= maxValue) {
          values[idx] = v * p;
          fixed = true;
          break;
        }
        if (v % p === 0 && v / p >= minValue) {
          values[idx] = v / p;
          fixed = true;
          break;
        }
      }

      if (!fixed) {
        // Replace one random cell with a clean multiple of p in [minValue, maxValue]
        const multMin = Math.ceil(minValue / p);
        const multMax = Math.floor(maxValue / p);
        if (multMin <= multMax) {
          const idx = randInt(0, values.length - 1);
          values[idx] = p * randInt(multMin, multMax);
        } else {
          break;
        }
      }

      oddPrimes = getOddPrimes(values);
    }

    if (getOddPrimes(values).length === 0) {
      const freq = new Map<number, number>();
      let maxFreq = 0;
      for (const v of values) {
        const c = (freq.get(v) ?? 0) + 1;
        freq.set(v, c);
        if (c > maxFreq) maxFreq = c;
      }
      if (maxFreq <= maxSame) {
        return shuffle(values);
      }
    }
  }

  // Guaranteed fallback: pairs of diverse composites sharing common factors
  const pairs: number[] = [];
  const half = totalCells / 2;
  const fallbackPool =
    minValue >= 20
      ? [24, 28, 36, 42, 48, 54, 56, 63, 72, 84, 96, 108, 120, 144, 168, 180]
      : [6, 8, 10, 12, 14, 15, 18, 20, 24, 28, 30, 36, 42, 48];
  const validPool = fallbackPool.filter(
    (v) => v >= minValue && v <= maxValue
  );
  for (let i = 0; i < half; i++) {
    const val =
      validPool.length > 0
        ? validPool[i % validPool.length]
        : randInt(minValue, maxValue);
    pairs.push(val, val);
  }
  return shuffle(pairs);
}

function isEmptyOrEndpoint(
  pos: GridCoord,
  end1: GridCoord,
  end2: GridCoord,
  grid: NumberGrid
): boolean {
  if (
    (pos.r === end1.r && pos.c === end1.c) ||
    (pos.r === end2.r && pos.c === end2.c)
  ) {
    return true;
  }
  const size = grid.length;
  if (pos.r >= 0 && pos.r < size && pos.c >= 0 && pos.c < size) {
    return grid[pos.r][pos.c] === null;
  }
  return true;
}

function checkLine(
  p1: GridCoord,
  p2: GridCoord,
  grid: NumberGrid
): GridCoord[] | null {
  const size = grid.length;

  if (p1.r === p2.r) {
    if (p1.r >= 0 && p1.r < size) {
      const minC = Math.min(p1.c, p2.c);
      const maxC = Math.max(p1.c, p2.c);
      for (let c = Math.max(0, minC + 1); c < Math.min(size, maxC); c++) {
        if (grid[p1.r][c] !== null) return null;
      }
    }
    return [p1, p2];
  }

  if (p1.c === p2.c) {
    if (p1.c >= 0 && p1.c < size) {
      const minR = Math.min(p1.r, p2.r);
      const maxR = Math.max(p1.r, p2.r);
      for (let r = Math.max(0, minR + 1); r < Math.min(size, maxR); r++) {
        if (grid[r][p1.c] !== null) return null;
      }
    }
    return [p1, p2];
  }

  return null;
}

function checkLPath(
  p1: GridCoord,
  p2: GridCoord,
  grid: NumberGrid
): GridCoord[] | null {
  const corner1: GridCoord = { r: p1.r, c: p2.c };
  if (
    isEmptyOrEndpoint(corner1, p1, p2, grid) &&
    checkLine(p1, corner1, grid) &&
    checkLine(corner1, p2, grid)
  ) {
    return [p1, corner1, p2];
  }

  const corner2: GridCoord = { r: p2.r, c: p1.c };
  if (
    isEmptyOrEndpoint(corner2, p1, p2, grid) &&
    checkLine(p1, corner2, grid) &&
    checkLine(corner2, p2, grid)
  ) {
    return [p1, corner2, p2];
  }

  return null;
}

function checkZAndUPath(
  p1: GridCoord,
  p2: GridCoord,
  grid: NumberGrid
): GridCoord[] | null {
  const size = grid.length;

  // Z-shape: horizontal -> vertical -> horizontal (inside board)
  for (let c = 0; c < size; c++) {
    if (c === p1.c || c === p2.c) continue;
    const mid1: GridCoord = { r: p1.r, c };
    const mid2: GridCoord = { r: p2.r, c };
    if (
      isEmptyOrEndpoint(mid1, p1, p2, grid) &&
      isEmptyOrEndpoint(mid2, p1, p2, grid) &&
      checkLine(p1, mid1, grid) &&
      checkLine(mid1, mid2, grid) &&
      checkLine(mid2, p2, grid)
    ) {
      return [p1, mid1, mid2, p2];
    }
  }

  // Z-shape: vertical -> horizontal -> vertical (inside board)
  for (let r = 0; r < size; r++) {
    if (r === p1.r || r === p2.r) continue;
    const mid1: GridCoord = { r, c: p1.c };
    const mid2: GridCoord = { r, c: p2.c };
    if (
      isEmptyOrEndpoint(mid1, p1, p2, grid) &&
      isEmptyOrEndpoint(mid2, p1, p2, grid) &&
      checkLine(p1, mid1, grid) &&
      checkLine(mid1, mid2, grid) &&
      checkLine(mid2, p2, grid)
    ) {
      return [p1, mid1, mid2, p2];
    }
  }

  // U-shape outside top edge (r = -1)
  if (p1.r >= 0 && p2.r >= 0) {
    let ok1 = true;
    for (let r = 0; r < p1.r; r++) {
      if (grid[r][p1.c] !== null) {
        ok1 = false;
        break;
      }
    }
    let ok2 = true;
    for (let r = 0; r < p2.r; r++) {
      if (grid[r][p2.c] !== null) {
        ok2 = false;
        break;
      }
    }
    if (ok1 && ok2) {
      return [p1, { r: -1, c: p1.c }, { r: -1, c: p2.c }, p2];
    }
  }

  // U-shape outside bottom edge (r = size)
  if (p1.r < size && p2.r < size) {
    let ok1 = true;
    for (let r = p1.r + 1; r < size; r++) {
      if (grid[r][p1.c] !== null) {
        ok1 = false;
        break;
      }
    }
    let ok2 = true;
    for (let r = p2.r + 1; r < size; r++) {
      if (grid[r][p2.c] !== null) {
        ok2 = false;
        break;
      }
    }
    if (ok1 && ok2) {
      return [p1, { r: size, c: p1.c }, { r: size, c: p2.c }, p2];
    }
  }

  // U-shape outside left edge (c = -1)
  if (p1.c >= 0 && p2.c >= 0) {
    let ok1 = true;
    for (let c = 0; c < p1.c; c++) {
      if (grid[p1.r][c] !== null) {
        ok1 = false;
        break;
      }
    }
    let ok2 = true;
    for (let c = 0; c < p2.c; c++) {
      if (grid[p2.r][c] !== null) {
        ok2 = false;
        break;
      }
    }
    if (ok1 && ok2) {
      return [p1, { r: p1.r, c: -1 }, { r: p2.r, c: -1 }, p2];
    }
  }

  // U-shape outside right edge (c = size)
  if (p1.c < size && p2.c < size) {
    let ok1 = true;
    for (let c = p1.c + 1; c < size; c++) {
      if (grid[p1.r][c] !== null) {
        ok1 = false;
        break;
      }
    }
    let ok2 = true;
    for (let c = p2.c + 1; c < size; c++) {
      if (grid[p2.r][c] !== null) {
        ok2 = false;
        break;
      }
    }
    if (ok1 && ok2) {
      return [p1, { r: p1.r, c: size }, { r: p2.r, c: size }, p2];
    }
  }

  return null;
}

export function findConnectionPath(
  grid: NumberGrid,
  p1: GridCoord,
  p2: GridCoord
): GridCoord[] | null {
  if (p1.r === p2.r && p1.c === p2.c) return null;
  const v1 = grid[p1.r]?.[p1.c];
  const v2 = grid[p2.r]?.[p2.c];
  if (v1 === null || v1 === undefined || v2 === null || v2 === undefined) {
    return null;
  }

  return (
    checkLine(p1, p2, grid) ??
    checkLPath(p1, p2, grid) ??
    checkZAndUPath(p1, p2, grid)
  );
}

export function findValidPair(
  grid: NumberGrid
): { p1: GridCoord; p2: GridCoord; path: GridCoord[] } | null {
  const size = grid.length;
  for (let r1 = 0; r1 < size; r1++) {
    for (let c1 = 0; c1 < size; c1++) {
      const v1 = grid[r1][c1];
      if (v1 === null) continue;
      for (let r2 = r1; r2 < size; r2++) {
        const startC = r2 === r1 ? c1 + 1 : 0;
        for (let c2 = startC; c2 < size; c2++) {
          const v2 = grid[r2][c2];
          if (v2 === null) continue;
          if (v1 !== v2 && gcd(v1, v2) <= 1) continue;
          const path = findConnectionPath(
            grid,
            { r: r1, c: c1 },
            { r: r2, c: c2 }
          );
          if (path) {
            return { p1: { r: r1, c: c1 }, p2: { r: r2, c: c2 }, path };
          }
        }
      }
    }
  }
  return null;
}

export function countRemainingCells(grid: NumberGrid): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== null) count++;
    }
  }
  return count;
}

export function generateNumberLinkBoard(modeId: NumberLinkModeId): NumberGrid {
  const cfg = NUMBER_LINK_MODES[modeId];

  for (let attempt = 0; attempt < 25; attempt++) {
    const values = buildBalancedValues(cfg.size, cfg.minValue, cfg.maxValue);
    const grid: NumberGrid = [];
    let idx = 0;
    for (let r = 0; r < cfg.size; r++) {
      const row: (number | null)[] = [];
      for (let c = 0; c < cfg.size; c++) {
        row.push(values[idx++]);
      }
      grid.push(row);
    }

    if (findValidPair(grid) !== null) {
      return grid;
    }
  }

  // Safe fallback
  const fallbackGrid: NumberGrid = [];
  const baseVals = buildBalancedValues(cfg.size, cfg.minValue, cfg.maxValue);
  let idx = 0;
  for (let r = 0; r < cfg.size; r++) {
    const row: (number | null)[] = [];
    for (let c = 0; c < cfg.size; c++) {
      row.push(baseVals[idx++]);
    }
    fallbackGrid.push(row);
  }
  return fallbackGrid;
}
