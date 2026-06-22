export interface EndpointForm {
  platform: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ProbeResult {
  id: string;
  title: string;
  category: string;
  dimension: string;
  weight: number;
  score: number;
  passed: boolean;
  note: string;
  latencyMs: number;
  status: number | null;
  content: string;
  finishReason: string | null;
  usage: unknown;
  responseModel: string | null;
}

export interface ProbeSideReport {
  label: "target";
  model: string;
  platform: string;
  baseUrl: string;
  results: ProbeResult[];
  summary: {
    weightedScore: number;
    passRate: number;
    avgLatencyMs: number;
    errors: number;
    transportErrors: number;
    dimensionScores: Record<string, number>;
  };
  metrics?: SiteMetrics;
}

export interface SiteMetrics {
  onlineRate: number;
  dilutionRate: number;
  protocolScore: number;
  avgLatencyMs: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
    level: "less" | "average" | "more" | "unknown";
  };
  statusLabel: string;
  statusTone: "ok" | "warn" | "bad";
  signals: string[];
}

export interface ProbeReport {
  ok: true;
  generatedAt: string;
  target: ProbeSideReport;
  modelProfile: {
    tier: "flagship" | "strong" | "standard" | "economy" | "unknown";
    expectedScore: number;
    label: string;
  };
  verdict: {
    risk: number;
    band: "low" | "medium" | "high";
    label: string;
    expectedScore: number;
    evidence: string[];
  };
}
