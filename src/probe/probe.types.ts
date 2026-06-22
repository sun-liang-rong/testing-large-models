export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface EndpointConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  platform?: string;
}

export interface ProbeDefinition {
  id: string;
  title: string;
  category: string;
  dimension: ProbeDimension;
  weight: number;
  maxTokens: number;
  messages: ChatMessage[];
  evaluate: (text: string) => ProbeEvaluation;
}

export type ProbeDimension =
  | "format"
  | "instruction"
  | "reasoning"
  | "context"
  | "coding"
  | "multilingual"
  | "reliability";

export interface ProbeEvaluation {
  score: number;
  passed: boolean;
  note: string;
}

export interface ProbeResult {
  id: string;
  title: string;
  category: string;
  dimension: ProbeDimension;
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

export interface SideSummary {
  weightedScore: number;
  passRate: number;
  avgLatencyMs: number;
  errors: number;
  transportErrors: number;
  dimensionScores: Record<string, number>;
}

export interface ProbeSideReport {
  label: "target";
  model: string;
  platform: string;
  baseUrl: string;
  results: ProbeResult[];
  summary: SideSummary;
}
