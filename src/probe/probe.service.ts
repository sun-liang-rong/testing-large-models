import { BadRequestException, Injectable, Optional } from "@nestjs/common";
import fetch from "node-fetch";
import { RunProbeDto } from "./dto/run-probe.dto";
import {
  EndpointConfig,
  ProbeDefinition,
  ProbeResult,
  ProbeSideReport
} from "./probe.types";
import { buildMetrics, buildVerdict, round, summarizeSide } from "./scoring/report-scoring";
import { profileModel } from "./scoring/model-profile";
import { buildProbes } from "./probes/probe-definitions";

const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_PROBE_CONCURRENCY = 4;

interface ChatCompletionResult {
  ok: boolean;
  latencyMs: number;
  status?: number;
  error?: string;
  content?: string;
  finishReason?: string | null;
  usage?: unknown;
  responseModel?: string | null;
}

type FetchLike = typeof fetch;

@Injectable()
export class ProbeService {
  constructor(@Optional() private readonly fetchClient: FetchLike = fetch) {}

  async run(dto: RunProbeDto) {
    this.validateEndpoint(dto.target, "目标端点");
    const profile = profileModel(dto.target.model);
    const probes = buildProbes(dto.target.model);
    const target = await this.runTarget(dto.target, probes, DEFAULT_TIMEOUT_MS);

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      target,
      modelProfile: profile,
      verdict: buildVerdict(target, profile)
    };
  }

  private async runTarget(
    config: EndpointConfig,
    probes: ProbeDefinition[],
    timeoutMs: number
  ): Promise<ProbeSideReport> {
    const results = await this.mapWithConcurrency(probes, DEFAULT_PROBE_CONCURRENCY, async (probe) => {
      const apiResult = await this.callChatCompletion(config, probe, timeoutMs);
      if (!apiResult.ok) {
        return {
          id: probe.id,
          title: probe.title,
          category: probe.category,
          dimension: probe.dimension,
          weight: probe.weight,
          score: 0,
          passed: false,
          note: apiResult.error || "请求失败",
          latencyMs: apiResult.latencyMs,
          status: apiResult.status || null,
          content: "",
          finishReason: null,
          usage: null,
          responseModel: null
        };
      }
      const evaluation = probe.evaluate(apiResult.content || "");
      return {
        id: probe.id,
        title: probe.title,
        category: probe.category,
        dimension: probe.dimension,
        weight: probe.weight,
        score: round(evaluation.score),
        passed: evaluation.passed,
        note: evaluation.note,
        latencyMs: apiResult.latencyMs,
        status: apiResult.status || null,
        content: apiResult.content || "",
        finishReason: apiResult.finishReason || null,
        usage: apiResult.usage || null,
        responseModel: apiResult.responseModel || null
      };
    });

    const summary = summarizeSide(results);

    return {
      label: "target",
      model: config.model,
      platform: config.platform || "custom",
      baseUrl: this.redactUrl(config.baseUrl),
      results,
      summary,
      metrics: buildMetrics(results, summary, profileModel(config.model), config.model)
    };
  }

  private async callChatCompletion(
    config: EndpointConfig,
    probe: ProbeDefinition,
    timeoutMs: number
  ): Promise<ChatCompletionResult> {
    const startedAt = Date.now();
    let endpoint: string;
    try {
      endpoint = this.normalizeEndpoint(config.baseUrl);
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Base URL 无效"
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetchClient(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey || ""}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: probe.messages,
          temperature: 0.1,
          max_tokens: probe.maxTokens,
          stream: false
        })
      });
      const bodyText = await response.text();
      const latencyMs = Date.now() - startedAt;
      const json = this.safeJson(bodyText);
      if (!response.ok) {
        return {
          ok: false,
          latencyMs,
          status: response.status,
          error:
            json?.error?.message ||
            json?.error?.code ||
            bodyText.slice(0, 500) ||
            `HTTP ${response.status}`
        };
      }

      const content = this.extractMessageContent(json?.choices?.[0]?.message?.content);
      return {
        ok: true,
        latencyMs,
        status: response.status,
        content,
        finishReason: json?.choices?.[0]?.finish_reason || null,
        usage: json?.usage || null,
        responseModel: json?.model || null
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error:
          error instanceof Error && error.name === "AbortError"
            ? `请求超时 ${timeoutMs}ms`
            : error instanceof Error
            ? error.message
            : "请求失败"
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(concurrency, 1), items.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
          const currentIndex = nextIndex;
          nextIndex += 1;
          results[currentIndex] = await worker(items[currentIndex], currentIndex);
        }
      })
    );
    return results;
  }

  private normalizeEndpoint(baseUrl: string) {
    const raw = String(baseUrl || "").trim();
    if (!raw) throw new BadRequestException("缺少 API Base URL");
    const withoutSlash = raw.replace(/\/+$/, "");
    if (/\/chat\/completions$/i.test(withoutSlash)) return withoutSlash;
    if (/\/openai$/i.test(withoutSlash)) return `${withoutSlash}/chat/completions`;
    if (/\/v1$/i.test(withoutSlash)) return `${withoutSlash}/chat/completions`;
    return `${withoutSlash}/v1/chat/completions`;
  }

  private validateEndpoint(config: EndpointConfig, label: string) {
    if (!String(config.baseUrl || "").trim()) throw new BadRequestException(`${label} 缺少 Base URL`);
    if (!String(config.apiKey || "").trim()) throw new BadRequestException(`${label} 缺少 API Key`);
    if (!String(config.model || "").trim()) throw new BadRequestException(`${label} 缺少模型名`);
  }

  private extractMessageContent(content: unknown) {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object") {
            const value = part as { text?: unknown; content?: unknown };
            if (typeof value.text === "string") return value.text;
            if (typeof value.content === "string") return value.content;
          }
          return "";
        })
        .filter(Boolean)
        .join("");
    }
    return "";
  }

  private safeJson(text: string): any {
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  private redactUrl(raw: string) {
    try {
      const url = new URL(raw);
      return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
    } catch (_) {
      return String(raw || "").replace(/[?#].*$/, "");
    }
  }
}
