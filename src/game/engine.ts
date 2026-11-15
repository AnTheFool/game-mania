import {
  CellKey,
  Coord,
  GameSnapshot,
  MAX_NUMBER,
  MoveRecord,
  NUMBER_COUNT,
  PuzzleData,
  RETRACE_CHANCE,
  SIZE_X,
  SIZE_Y,
  SIZE_Z,
  TOTAL_CELLS,
  YELLOW_DECOYS,
} from './types';

export function keyOf(p: Coord): CellKey {
  return `${p[0]},${p[1]},${p[2]}`;
}

export function parseKey(k: CellKey): Coord {
  const [x, y, z] = k.split(',').map(Number);
  return [x, y, z];
}

export function inside(p: Coord): boolean {
  return (
    p[0] >= 0 &&
    p[0] < SIZE_X &&
    p[1] >= 0 &&
    p[1] < SIZE_Y &&
    p[2] >= 0 &&
    p[2] < SIZE_Z
  );
}

export function addCoord(p: Coord, d: Coord): Coord {
  return [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export class GameEngine {
  readonly start: Coord;
  readonly yellow: Set<CellKey>;
  readonly initNumbers: Map<CellKey, number>;

  pos!: Coord;
  visited!: Set<CellKey>;
  numbers!: Map<CellKey, number>;
  red!: Set<CellKey>;
  history!: MoveRecord[];

  constructor(start: Coord, yellow: Iterable<CellKey>, numbers: Record<CellKey, number>) {
    this.start = [...start] as Coord;
    this.yellow = new Set(yellow);
    this.initNumbers = new Map(
      Object.entries(numbers).map(([k, v]) => [k, v])
    );
    this.reset();
  }

  reset(): void {
    this.pos = [...this.start] as Coord;
    this.visited = new Set([keyOf(this.start)]);
    this.numbers = new Map(this.initNumbers);
    this.red = new Set();
    this.history = [];
  }

  plan(d: Coord): Coord[] {
    const path: Coord[] = [];
    let p: Coord = [...this.pos] as Coord;
    while (true) {
      const n = addCoord(p, d);
      const nk = keyOf(n);
      if (!inside(n) || this.red.has(nk)) {
        break;
      }
      path.push(n);
      p = n;
      if (this.yellow.has(nk)) {
        break;
      }
    }
    return path;
  }

  apply(d: Coord): MoveRecord | null {
    const path = this.plan(d);
    if (path.length === 0) return null;

    const rec: MoveRecord = {
      prev: [...this.pos] as Coord,
      path,
      newlyVisited: [],
      numsChanged: [],
    };

    for (const p of path) {
      const k = keyOf(p);
      if (!this.visited.has(k)) {
        this.visited.add(k);
        rec.newlyVisited.push(k);
      }
      if (this.numbers.has(k)) {
        const old = this.numbers.get(k)!;
        rec.numsChanged.push([k, old]);
        const nextVal = old - 1;
        this.numbers.set(k, nextVal);
        if (nextVal <= 0) {
          this.red.add(k);
        }
      }
    }

    this.pos = [...path[path.length - 1]] as Coord;
    this.history.push(rec);
    return rec;
  }

  undo(): MoveRecord | null {
    const rec = this.history.pop();
    if (!rec) return null;

    for (const k of rec.newlyVisited) {
      this.visited.delete(k);
    }
    for (const [k, old] of rec.numsChanged) {
      this.numbers.set(k, old);
      this.red.delete(k);
    }
    this.pos = [...rec.prev] as Coord;
    return rec;
  }

  progress(): number {
    let normal = 0;
    for (const k of this.visited) {
      if (!this.initNumbers.has(k)) {
        normal += 1;
      }
    }
    return normal + this.red.size;
  }

  complete(): boolean {
    return this.progress() === TOTAL_CELLS;
  }

  remainingNumberCells(): number {
    let count = 0;
    for (const k of this.initNumbers.keys()) {
      if (!this.red.has(k)) count += 1;
    }
    return count;
  }

  snapshot(): GameSnapshot {
    return {
      pos: [...this.pos] as Coord,
      visited: new Set(this.visited),
      numbers: new Map(this.numbers),
      red: new Set(this.red),
      steps: this.history.length,
      progress: this.progress(),
      complete: this.complete(),
    };
  }
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function walkToWall(p: Coord, d: Coord): Coord {
  let curr: Coord = [...p] as Coord;
  while (inside(addCoord(curr, d))) {
    curr = addCoord(curr, d);
  }
  return curr;
}

function layerSnake(
  corner: Coord,
  a: 0 | 1
): { moves: Array<[Coord, Coord]>; yellow: CellKey[]; end: Coord } {
  const b: 0 | 1 = a === 0 ? 1 : 0;
  const size: [number, number] = [SIZE_X, SIZE_Y];
  const z = corner[2];
  let sa = corner[a] === 0 ? 1 : -1;
  const sb = corner[b] === 0 ? 1 : -1;
  const pos: [number, number] = [corner[0], corner[1]];
  const moves: Array<[Coord, Coord]> = [];
  const yellow: CellKey[] = [];

  for (let r = 0; r < size[b]; r++) {
    const d: Coord = [0, 0, 0];
    d[a] = sa;
    pos[a] += sa * (size[a] - 1);
    moves.push([d, [pos[0], pos[1], z]]);

    if (Math.random() < RETRACE_CHANCE) {
      const L = randInt(1, size[a] - 1);
      const back: Coord = [0, 0, 0];
      back[a] = -sa;
      const ypos: [number, number] = [pos[0], pos[1]];
      ypos[a] -= sa * L;
      moves.push([back, [ypos[0], ypos[1], z]]);
      if (L < size[a] - 1) {
        yellow.push(keyOf([ypos[0], ypos[1], z]));
      }
      moves.push([[...d] as Coord, [pos[0], pos[1], z]]);
    }

    sa = -sa;
    if (r < size[b] - 1) {
      const stepB: Coord = [0, 0, 0];
      stepB[b] = sb;
      pos[b] += sb;
      moves.push([stepB, [pos[0], pos[1], z]]);
      yellow.push(keyOf([pos[0], pos[1], z]));
    }
  }

  return { moves, yellow, end: [pos[0], pos[1], z] };
}

function buildReference(): {
  start: Coord;
  route: Array<[Coord, Coord]>;
  yellow: Set<CellKey>;
} {
  const boundary: Coord[] = [];
  for (let x = 0; x < SIZE_X; x++) {
    for (let y = 0; y < SIZE_Y; y++) {
      if (x === 0 || y === 0) {
        boundary.push([x, y, 0]);
      }
    }
  }

  const start = boundary[Math.floor(Math.random() * boundary.length)];
  const route: Array<[Coord, Coord]> = [];
  const yellow = new Set<CellKey>();
  let pos: Coord = [...start] as Coord;

  const cornerX = start[0] === 0 || start[0] === SIZE_X - 1;
  const cornerY = start[1] === 0 || start[1] === SIZE_Y - 1;
  if (!(cornerX && cornerY)) {
    const d: Coord = cornerX
      ? [0, Math.random() < 0.5 ? 1 : -1, 0]
      : [Math.random() < 0.5 ? 1 : -1, 0, 0];
    pos = walkToWall(pos, d);
    route.push([d, pos]);
  }

  for (let z = 0; z < SIZE_Z; z++) {
    const axis: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    const { moves, yellow: yel, end } = layerSnake(pos, axis);
    route.push(...moves);
    for (const yk of yel) yellow.add(yk);
    pos = end;
    if (z < SIZE_Z - 1) {
      const nxt: Coord = [end[0], end[1], z + 1];
      route.push([[0, 0, 1], nxt]);
      if (z + 1 < SIZE_Z - 1) {
        yellow.add(keyOf(nxt));
      }
      pos = nxt;
    }
  }

  return { start, route, yellow };
}

function replay(
  start: Coord,
  yellow: Set<CellKey>,
  numbers: Record<CellKey, number>,
  route: Array<[Coord, Coord]>
): GameEngine | null {
  const eng = new GameEngine(start, yellow, numbers);
  for (const [d, expected] of route) {
    let guard = 0;
    while (!sameCoord(eng.pos, expected)) {
      if (eng.apply(d) === null) return null;
      if (++guard > 32) return null;
    }
  }
  return eng;
}

let puzzleSequence = 0;

export function generatePuzzle(maxTries = 1000): PuzzleData {
  const cells: Coord[] = [];
  for (let x = 0; x < SIZE_X; x++) {
    for (let y = 0; y < SIZE_Y; y++) {
      for (let z = 0; z < SIZE_Z; z++) {
        cells.push([x, y, z]);
      }
    }
  }

  for (let t = 0; t < maxTries; t++) {
    const { start, route, yellow } = buildReference();
    const startKey = keyOf(start);
    if (yellow.has(startKey)) continue;

    const pool = cells
      .map(keyOf)
      .filter((k) => k !== startKey && !yellow.has(k));
    shuffle(pool);

    const yellow2 = new Set(yellow);
    for (const dk of pool.slice(0, YELLOW_DECOYS)) {
      yellow2.add(dk);
    }

    const eng = replay(start, yellow2, {}, route);
    if (!eng || !eng.complete()) continue;

    const enter = new Map<CellKey, number>();
    for (const rec of eng.history) {
      for (const p of rec.path) {
        const k = keyOf(p);
        enter.set(k, (enter.get(k) ?? 0) + 1);
      }
    }

    const rest = cells
      .map(keyOf)
      .filter((k) => {
        const count = enter.get(k) ?? 0;
        return k !== startKey && !yellow2.has(k) && count >= 1 && count <= MAX_NUMBER;
      });
    shuffle(rest);

    const chosen: CellKey[] = rest
      .filter((k) => (enter.get(k) ?? 0) >= 2)
      .slice(0, Math.floor(NUMBER_COUNT / 2));
    for (const k of rest) {
      if (chosen.length >= NUMBER_COUNT) break;
      if (!chosen.includes(k)) chosen.push(k);
    }

    const numbers: Record<CellKey, number> = {};
    for (const k of chosen) {
      numbers[k] = enter.get(k)!;
    }

    const eng2 = replay(start, yellow2, numbers, route);
    if (!eng2 || !eng2.complete()) continue;

    puzzleSequence += 1;
    return {
      id: puzzleSequence,
      start,
      yellow: Array.from(yellow2),
      numbers,
      refSteps: eng2.history.length,
    };
  }

  throw new Error('Không thể tạo màn chơi mới. Vui lòng thử lại.');
}
