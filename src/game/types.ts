export const SIZE_X = 8;
export const SIZE_Y = 8;
export const SIZE_Z = 3;
export const TOTAL_CELLS = SIZE_X * SIZE_Y * SIZE_Z;
export const SPACING = 2.2;
export const STEP_DURATION_MS = 250;

export const YELLOW_DECOYS = 6;
export const NUMBER_COUNT = 10;
export const MAX_NUMBER = 4;
export const RETRACE_CHANCE = 0.3;

export type Coord = [number, number, number];
export type CellKey = string;

export type DirectionName = 'Lên' | 'Xuống' | 'Trái' | 'Phải' | 'Tiến' | 'Lùi';

export interface DirectionMeta {
  name: DirectionName;
  vector: Coord;
  shortcutLabel: string;
  axisHint: string;
}

export const DIRECTIONS: Record<DirectionName, DirectionMeta> = {
  Lên: {
    name: 'Lên',
    vector: [0, 0, 1],
    shortcutLabel: 'W',
    axisHint: '+Z',
  },
  Xuống: {
    name: 'Xuống',
    vector: [0, 0, -1],
    shortcutLabel: 'S',
    axisHint: '-Z',
  },
  Trái: {
    name: 'Trái',
    vector: [-1, 0, 0],
    shortcutLabel: '←',
    axisHint: '-X',
  },
  Phải: {
    name: 'Phải',
    vector: [1, 0, 0],
    shortcutLabel: '→',
    axisHint: '+X',
  },
  Tiến: {
    name: 'Tiến',
    vector: [0, 1, 0],
    shortcutLabel: '↑',
    axisHint: '+Y',
  },
  Lùi: {
    name: 'Lùi',
    vector: [0, -1, 0],
    shortcutLabel: '↓',
    axisHint: '-Y',
  },
};

export interface MoveRecord {
  prev: Coord;
  path: Coord[];
  newlyVisited: CellKey[];
  numsChanged: Array<[CellKey, number]>;
}

export interface TrackSegment {
  from: Coord;
  to: Coord;
}

export interface PuzzleData {
  id: number;
  start: Coord;
  yellow: CellKey[];
  numbers: Record<CellKey, number>;
  refSteps: number;
}

export interface GameSnapshot {
  pos: Coord;
  visited: Set<CellKey>;
  numbers: Map<CellKey, number>;
  red: Set<CellKey>;
  steps: number;
  progress: number;
  complete: boolean;
}

export type ModalState =
  | null
  | { type: 'confirm-reset' }
  | { type: 'confirm-new' }
  | { type: 'confirm-submit' }
  | { type: 'result-optimal'; steps: number; refSteps: number }
  | { type: 'result-suboptimal'; steps: number; refSteps: number }
  | { type: 'result-incomplete'; progress: number; remainingNumbers: number };
