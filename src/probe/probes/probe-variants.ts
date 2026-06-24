import { hashString, nextPrimes, token } from "./probe-utils";

export interface ProbeVariant {
  runId: string;
  claimedModel: string;
  math: {
    left: number;
    right: number;
    answer: number;
    code: string;
    threshold: number;
    sequence: number[];
    checksum: number;
  };
  instruction: {
    keepToken: string;
    distractor: string;
  };
  signature: string;
  grid: {
    rows: number;
    cols: number;
    startRow: number;
    startCol: number;
    moves: Array<{ label: string; deltaRow: number; deltaCol: number }>;
    answer: number;
  };
  logic: {
    people: [string, string, string];
    colors: [string, string, string];
    targetColor: string;
    answer: string;
  };
  counterfactual: {
    subject: string;
    dax: string;
    lim: string;
    vor: string;
  };
  needle: {
    value: string;
    index: number;
  };
  code: {
    values: number[];
    seed: number;
    answer: number;
  };
  tool: {
    retries: number;
    tags: string[];
  };
  multilingual: {
    token: string;
  };
  csv: {
    name: string;
    score: number;
  };
}

export function buildProbeVariant(claimedModel: string): ProbeVariant {
  const seed = hashString(`${claimedModel}:${Date.now()}:${Math.random()}`);
  const pick = <T>(items: T[], offset: number) => items[(seed + offset) % items.length];
  const left = 31 + (seed % 29);
  const right = 42 + ((seed >>> 3) % 37);
  const threshold = 17 + ((seed >>> 5) % 12);
  const sequence = nextPrimes(threshold, 4);
  const codeValues = [
    2 + (seed % 4) * 2,
    5,
    8 + ((seed >>> 4) % 3) * 2,
    11,
    14 + ((seed >>> 6) % 3) * 2
  ];
  const codeSeed = 2 + ((seed >>> 8) % 5);
  const codeAnswer = codeValues
    .filter((value) => value % 2 === 0)
    .map((value) => value / 2)
    .reduce((sum, value) => sum + value, codeSeed);
  const people = [
    pick(["Ada", "Nora", "Iris"], 1),
    pick(["Ben", "Owen", "Milo"], 2),
    pick(["Chen", "Lena", "Ravi"], 3)
  ] as [string, string, string];
  const colors = [
    pick(["red", "yellow", "white"], 4),
    pick(["blue", "purple", "orange"], 5),
    pick(["green", "silver", "black"], 6)
  ] as [string, string, string];

  return {
    runId: `run-${token(seed, 4)}-${100 + (seed % 800)}`,
    claimedModel,
    math: {
      left,
      right,
      answer: left + right,
      code: `M-${7 + (seed % 8)}Q-${19 + ((seed >>> 2) % 11)}`,
      threshold,
      sequence,
      checksum: left + right + sequence[sequence.length - 1]
    },
    instruction: {
      keepToken: `<<${pick(["violet", "indigo", "cobalt", "amber"], 7)}-${300 + (seed % 600)}>>`,
      distractor: pick(["sunflower", "marigold", "orchid", "lavender"], 8)
    },
    signature: `SIG|A${10 + (seed % 80)}|模型=真|hash=${token(seed >>> 4, 4)}|end`,
    grid: buildGridVariant(seed),
    logic: {
      people,
      colors,
      targetColor: colors[1],
      answer: people[0]
    },
    counterfactual: {
      subject: pick(["Mira", "Tao", "Rina", "Sol"], 9),
      dax: pick(["dax", "narp", "lume", "sov"], 10),
      lim: pick(["lim", "tovin", "merl", "cavo"], 11),
      vor: pick(["vor", "zel", "prax", "nilo"], 12)
    },
    needle: {
      value: `${pick(["RAVEN", "ORBIT", "CIPHER", "NOVA"], 13)}-${31 + (seed % 50)}-${pick(["ORBIT", "EMBER", "QUARTZ", "DELTA"], 14)}`,
      index: 18 + (seed % 24)
    },
    code: {
      values: codeValues,
      seed: codeSeed,
      answer: codeAnswer
    },
    tool: {
      retries: 1 + (seed % 3),
      tags: ["relay", pick(["auth", "latency", "fingerprint"], 15)]
    },
    multilingual: {
      token: `${pick(["BETA", "OMEGA", "SIGMA", "DELTA"], 16)}-${200 + (seed % 700)}`
    },
    csv: {
      name: `${pick(["Lin", "Qiao", "Ren", "Ming"], 17)}, ${pick(["Qiao", "Yu", "Kai", "Zhen"], 18)}`,
      score: 80 + (seed % 19)
    }
  };
}

export function describeMoves(moves: ProbeVariant["grid"]["moves"]) {
  return `Move ${moves.map((move) => move.label).join(", then ")}.`;
}

export function makeNeedlePrompt(needle: string, needleIndex: number) {
  const blocks: string[] = [];
  for (let index = 0; index < 54; index += 1) {
    blocks.push(
      `段落 ${index + 1}: 噪声文本。批次 ${1017 + index}，颜色 slate，城市 north，项目 delta。不要把这些词当作答案。`
    );
    if (index === needleIndex) blocks.push(`重要记录: audit_key = ${needle}。`);
  }
  return `${blocks.join("\n")}\n\n只输出 audit_key 的值。`;
}

function buildGridVariant(seed: number) {
  const rows = 7 + (seed % 3);
  const cols = 6 + ((seed >>> 2) % 3);
  const startRow = 1 + ((seed >>> 4) % 2);
  const startCol = 1 + ((seed >>> 6) % 2);
  const moves = [
    { label: `${2 + (seed % 3)} right`, deltaRow: 0, deltaCol: 2 + (seed % 3) },
    { label: `${1 + ((seed >>> 3) % 2)} down`, deltaRow: 1 + ((seed >>> 3) % 2), deltaCol: 0 },
    { label: "1 left", deltaRow: 0, deltaCol: -1 },
    { label: `${2 + ((seed >>> 5) % 2)} down`, deltaRow: 2 + ((seed >>> 5) % 2), deltaCol: 0 }
  ];
  const end = moves.reduce(
    (point, move) => ({
      row: point.row + move.deltaRow,
      col: point.col + move.deltaCol
    }),
    { row: startRow, col: startCol }
  );
  return {
    rows,
    cols,
    startRow,
    startCol,
    moves,
    answer: end.row + end.col
  };
}
