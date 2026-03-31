import { isColorSupported } from "./colors.js";

// ---------------------------------------------------------------------------
// Gradient stops: teal → indigo → purple → magenta → pink
// ---------------------------------------------------------------------------

const GRADIENT: [number, number, number][] = [
  [72, 191, 227], // teal
  [93, 96, 206], // indigo
  [114, 9, 183], // purple
  [181, 23, 158], // magenta
  [247, 37, 133], // pink
];

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function gradientColor(t: number): [number, number, number] {
  const segments = GRADIENT.length - 1;
  const scaled = t * segments;
  const i = Math.min(Math.floor(scaled), segments - 1);
  const frac = scaled - i;
  const a = GRADIENT[i]!;
  const b = GRADIENT[i + 1]!;
  return [lerp(a[0], b[0], frac), lerp(a[1], b[1], frac), lerp(a[2], b[2], frac)];
}

function rgb(r: number, g: number, b: number, text: string): string {
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

// ---------------------------------------------------------------------------
// Letter definitions (4 rows each, fixed width per letter + 1 space gap)
// ---------------------------------------------------------------------------

type Letter = [string, string, string, string];

const LETTERS: Record<string, Letter> = {
  H: ["█  █", "████", "█  █", "█  █"],
  Y: ["█  █", " ██ ", " ██ ", " ██ "],
  P: ["███ ", "█  █", "███ ", "█   "],
  E: ["████", "█   ", "███ ", "████"],
  R: ["███ ", "█  █", "███ ", "█ █ "],
  F: ["████", "█   ", "███ ", "█   "],
  A: [" ██ ", "█  █", "████", "█  █"],
  M: ["█   █", "██ ██", "█ █ █", "█   █"],
  S: [" ███", "█   ", " ██ ", "███ "],
};

function buildRows(): [string, string, string, string] {
  const word = "HYPERFRAMES";
  const rows: [string, string, string, string] = ["", "", "", ""];

  for (let i = 0; i < word.length; i++) {
    const letter = LETTERS[word[i]!];
    if (!letter) continue;
    const gap = i > 0 ? " " : "";
    for (let r = 0; r < 4; r++) {
      rows[r] += gap + letter[r];
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export function printBanner(): void {
  if (!isColorSupported || !process.stdout.isTTY) return;

  const rows = buildRows();
  const maxWidth = Math.max(...rows.map((r) => r.length));

  console.log();
  for (const row of rows) {
    let line = "  ";
    for (let col = 0; col < row.length; col++) {
      const ch = row[col];
      if (!ch || ch === " ") {
        line += " ";
        continue;
      }
      const t = maxWidth > 1 ? col / (maxWidth - 1) : 0;
      const [r, g, b] = gradientColor(t);
      line += rgb(r, g, b, ch);
    }
    console.log(line);
  }
  console.log();
}
