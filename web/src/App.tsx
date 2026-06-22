import { FormEvent, useMemo, useState } from "react";
import { findPlatform, platforms } from "./modelCatalog";
import { EndpointForm, ProbeReport, SiteMetrics } from "./types";

const firstPlatform = platforms[0];
const emptyEndpoint: EndpointForm = {
  platform: firstPlatform.id,
  baseUrl: firstPlatform.baseUrl,
  apiKey: "",
  model: firstPlatform.models[0].id
};

const loadingMessages = [
  "运行跨维度确定性探针...",
  "检查结构化输出、推理和上下文稳定性...",
  "评估模型档位与实际能力差距...",
  "整理异常证据和响应片段..."
];

const dimensionLabels: Record<string, string> = {
  format: "结构化",
  instruction: "指令",
  reasoning: "推理",
  context: "上下文",
  coding: "代码",
  multilingual: "多语言",
  reliability: "可靠性"
};

const tokenLevelLabels = {
  less: "较少",
  average: "正常",
  more: "偏高",
  unknown: "未知"
};

export default function App() {
  const [target, setTarget] = useState<EndpointForm>(emptyEndpoint);
  const [customModel, setCustomModel] = useState("");
  const [report, setReport] = useState<ProbeReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  const platform = findPlatform(target.platform);
  const selectedModel = target.model === "custom" ? customModel.trim() : target.model;
  const selectedModelOption = platform.models.find((model) => model.id === target.model);
  const loadingCopy = loadingMessages[loadingIndex % loadingMessages.length];

  function selectPlatform(platformId: string) {
    const next = findPlatform(platformId);
    setModelMenuOpen(false);
    setTarget({
      ...target,
      platform: next.id,
      baseUrl: next.baseUrl,
      model: next.models[0].id
    });
  }

  async function runProbe(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    const timer = window.setInterval(() => {
      setLoadingIndex((current) => current + 1);
    }, 2800);

    try {
      const response = await fetch("/api/probe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target: {
            ...target,
            model: selectedModel
          }
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || data.error || "检测失败");
      }
      setReport(data);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "检测失败");
    } finally {
      window.clearInterval(timer);
      setLoading(false);
      setLoadingIndex(0);
    }
  }

  function downloadReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `model-authenticity-report-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <section className="workspace">
        <aside className="config-panel" aria-label="检测配置">
          <Brand />
          <form className="stack" onSubmit={runProbe}>
            <fieldset>
              <legend>1. 选择平台</legend>
              <div className="platform-grid">
                {platforms.map((item) => (
                  <button
                    className={`platform-button ${target.platform === item.id ? "active" : ""}`}
                    key={item.id}
                    onClick={() => selectPlatform(item.id)}
                    style={{ "--accent": item.accent } as React.CSSProperties}
                    type="button"
                  >
                    <span className="platform-dot" />
                    <strong>{item.name}</strong>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>2. 选择模型</legend>
              <div
                className="model-select"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setModelMenuOpen(false);
                  }
                }}
              >
                <button
                  aria-expanded={modelMenuOpen}
                  aria-haspopup="listbox"
                  className="model-trigger"
                  onClick={() => setModelMenuOpen((open) => !open)}
                  type="button"
                >
                  <span>
                    <strong>
                      {target.model === "custom"
                        ? customModel || "手动输入模型名"
                        : selectedModelOption?.label || target.model}
                    </strong>
                    <em>
                      {target.model === "custom"
                        ? "自定义"
                        : `${selectedModelOption?.tier || "标准"} · ${platform.name}`}
                    </em>
                  </span>
                  <ChevronIcon />
                </button>
                {modelMenuOpen ? (
                  <div
                    className="model-menu"
                    role="listbox"
                    tabIndex={-1}
                  >
                    {platform.models.map((model) => (
                      <button
                        aria-selected={target.model === model.id}
                        className={`model-option ${target.model === model.id ? "active" : ""}`}
                        key={model.id}
                        onClick={() => {
                          setTarget({ ...target, model: model.id });
                          setModelMenuOpen(false);
                        }}
                        role="option"
                        type="button"
                      >
                        <span>
                          <strong>{model.label}</strong>
                          <em>{model.id}</em>
                        </span>
                        <b>{model.tier}</b>
                      </button>
                    ))}
                    <button
                      aria-selected={target.model === "custom"}
                      className={`model-option ${target.model === "custom" ? "active" : ""}`}
                      onClick={() => {
                        setTarget({ ...target, model: "custom" });
                        setModelMenuOpen(false);
                      }}
                      role="option"
                      type="button"
                    >
                      <span>
                        <strong>手动输入模型名</strong>
                        <em>适合未收录模型或私有别名</em>
                      </span>
                      <b>自定义</b>
                    </button>
                  </div>
                ) : null}
              </div>
              {target.model === "custom" ? (
                <label>
                  <span>模型名</span>
                  <input
                    autoComplete="off"
                    onChange={(event) => setCustomModel(event.target.value)}
                    placeholder="例如 gpt-4.1 / claude-sonnet-4..."
                    required
                    type="text"
                    value={customModel}
                  />
                </label>
              ) : null}
            </fieldset>

            <fieldset>
              <legend>3. 连接信息</legend>
              <label>
                <span>BASE URL</span>
                <input
                  autoComplete="off"
                  onChange={(event) => setTarget({ ...target, baseUrl: event.target.value })}
                  placeholder="https://relay.example.com/v1"
                  required
                  type="url"
                  value={target.baseUrl}
                />
              </label>
              <label>
                <span>API Key</span>
                <input
                  autoComplete="off"
                  onChange={(event) => setTarget({ ...target, apiKey: event.target.value })}
                  placeholder="sk-..."
                  required
                  type="password"
                  value={target.apiKey}
                />
              </label>
            </fieldset>

            <div className="probe-summary">
              <strong>13 项探针</strong>
              <span>身份一致性、签名指纹、协议结构、推理、上下文、Token 消耗与掺水率估算</span>
            </div>

            <button className="run-button" disabled={loading || !selectedModel} type="submit">
              {loading ? (
                <span>检测中...</span>
              ) : (
                <>
                  <PlayIcon />
                  开始检测
                </>
              )}
            </button>
          </form>
        </aside>

        <section className="report-area">
          {loading ? (
            <LoadingState copy={loadingCopy} />
          ) : error ? (
            <ErrorReport error={error} />
          ) : report ? (
            <ReportView report={report} onDownload={downloadReport} />
          ) : (
            <EmptyState />
          )}
        </section>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className="brand-row">
      <div className="mark" aria-hidden="true">
        <ShieldIcon />
      </div>
      <div>
        <p className="product-kicker">Model Authenticity Lab</p>
        <h1>模型真伪检测台</h1>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-visual">
        <SearchDocIcon />
      </div>
      <h2>检测中转站是否“参假”</h2>
      <p>选择平台和模型，填入 BASE URL 与 API Key，系统会运行跨维度探针并给出风险证据。</p>
      <div className="capability-strip">
        <span>在线率</span>
        <span>掺水率</span>
        <span>Token 消耗</span>
        <span>结构化输出</span>
        <span>签名指纹</span>
      </div>
    </div>
  );
}

function LoadingState({ copy }: { copy: string }) {
  return (
    <div className="loading-state">
      <div className="scanner" aria-hidden="true">
        <span />
      </div>
      <h2>正在检测模型行为指纹</h2>
      <p>{copy}</p>
    </div>
  );
}

function ErrorReport({ error }: { error: string }) {
  return (
    <div className="report">
      <header className="report-header">
        <div>
          <p className="eyebrow">检测报告</p>
          <h2>检测失败</h2>
          <p className="verdict-detail">{error}</p>
        </div>
        <RiskGauge risk={100} band="high" />
      </header>
      <section className="evidence-band">
        <h3>证据摘要</h3>
        <ul>
          <li>端点配置或网络请求失败，请检查 BASE URL、API Key、模型名和中转站兼容性。</li>
        </ul>
      </section>
    </div>
  );
}

function ReportView({
  report,
  onDownload
}: {
  report: ProbeReport;
  onDownload: () => void;
}) {
  const metrics = normalizeMetrics(report);
  const dimensionEntries = useMemo(() => {
    return Object.entries(report.target.summary.dimensionScores).sort((a, b) => a[0].localeCompare(b[0]));
  }, [report.target.summary.dimensionScores]);

  return (
    <div className="report">
      <header className="report-header">
        <div>
          <p className="eyebrow">检测报告</p>
          <h2>{report.verdict.label}</h2>
          <p className="verdict-detail">
            {report.target.model} · {report.modelProfile.label} · {report.target.baseUrl} ·{" "}
            {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        <RiskGauge risk={report.verdict.risk} band={report.verdict.band} />
      </header>

      <section className="metrics-grid" aria-label="汇总指标">
        <Metric label="在线率" value={percent(metrics.onlineRate)} tone="ok" />
        <Metric label="掺水率" value={percent(metrics.dilutionRate)} tone={metrics.statusTone} />
        <Metric label="Token 消耗" value={tokenLevelLabels[metrics.tokenUsage.level]} />
        <Metric label="平均延迟" value={`${metrics.avgLatencyMs}ms`} />
        <Metric label="综合得分" value={percent(report.target.summary.weightedScore)} />
        <Metric label="模型预期" value={percent(report.verdict.expectedScore)} />
        <Metric label="协议一致性" value={percent(metrics.protocolScore)} />
        <Metric label="运行状态" value={metrics.statusLabel} tone={metrics.statusTone} />
      </section>

      <section className="leaderboard-panel">
        <div className="section-heading">
          <h3>中转站指标</h3>
          <span className={`status-pill ${metrics.statusTone}`}>
            {metrics.statusLabel}
          </span>
        </div>
        <div className="site-table">
          <div className="site-row head">
            <span>模型</span>
            <span>Token</span>
            <span>在线率</span>
            <span>掺水率</span>
            <span>延迟</span>
            <span>状态</span>
          </div>
          <div className="site-row">
            <strong>{report.target.model}</strong>
            <span>{metrics.tokenUsage.total || "未知"}</span>
            <span>{percent(metrics.onlineRate)}</span>
            <span>{percent(metrics.dilutionRate)}</span>
            <span>{metrics.avgLatencyMs}ms</span>
            <span>{metrics.statusLabel}</span>
          </div>
        </div>
        <div className="signal-list">
          {metrics.signals.map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>
      </section>

      <section className="dimension-panel">
        <div className="section-heading plain">
          <h3>维度画像</h3>
        </div>
        <div className="dimension-grid">
          {dimensionEntries.map(([dimension, score]) => (
            <div className="dimension-item" key={dimension}>
              <div>
                <strong>{dimensionLabels[dimension] || dimension}</strong>
                <span>{percent(score)}</span>
              </div>
              <div className="bar">
                <i style={{ width: `${Math.round(score * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="evidence-band">
        <h3>证据摘要</h3>
        <ul>
          {report.verdict.evidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="table-wrap">
        <div className="section-heading">
          <h3>探针明细</h3>
          <button className="icon-button" onClick={onDownload} title="下载 JSON 报告" type="button">
            <DownloadIcon />
          </button>
        </div>
        <div className="probe-table">
          {report.target.results.map((target) => (
            <article className="probe-row" key={target.id}>
              <div className="probe-name">
                <strong>{target.title}</strong>
                <span>{target.category}</span>
              </div>
              <div className="probe-cell">
                <span className={`badge ${target.passed ? "pass" : "fail"}`}>
                  {target.passed ? "通过" : "异常"}
                </span>
              </div>
              <div className="probe-cell">
                <strong>{percent(target.score)}</strong>
                <span>{target.latencyMs || 0}ms</span>
              </div>
              <div className="probe-cell">
                <strong>{target.note}</strong>
                <div className="response-excerpt">{target.content || "无响应内容"}</div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function RiskGauge({ risk, band }: { risk: number; band: "low" | "medium" | "high" }) {
  const circumference = 314;
  const offset = circumference - (risk / 100) * circumference;
  return (
    <div className="risk-gauge" aria-label="风险分数">
      <svg viewBox="0 0 120 120">
        <circle className="gauge-track" cx="60" cy="60" r="50" />
        <circle
          className={`gauge-fill ${band}`}
          cx="60"
          cy="60"
          r="50"
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <strong>{risk}</strong>
      <span>风险</span>
    </div>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  return (
    <article className={`metric ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function normalizeMetrics(report: ProbeReport): SiteMetrics {
  if (report.target.metrics) return report.target.metrics;
  const results = report.target.results || [];
  const successCount = results.filter((item) => item.status && item.status >= 200 && item.status < 300 && item.content).length;
  const onlineRate = successCount / Math.max(results.length, 1);
  const statusTone: "ok" | "warn" | "bad" =
    onlineRate < 0.6 ? "bad" : report.target.summary.weightedScore < 0.72 ? "warn" : "ok";
  return {
    onlineRate,
    dilutionRate: Math.max(0, Math.min(1, 1 - report.target.summary.weightedScore)),
    protocolScore: onlineRate,
    avgLatencyMs: report.target.summary.avgLatencyMs,
    tokenUsage: {
      input: 0,
      output: 0,
      total: 0,
      level: "unknown" as const
    },
    statusLabel: statusTone === "ok" ? "运行正常" : statusTone === "warn" ? "需要复测" : "异常",
    statusTone,
    signals: ["当前报告来自旧版接口，已按基础结果降级展示"]
  };
}

function percent(value: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3l14 9-14 9V3z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.8-2.9 8.4-7 10-4.1-1.6-7-5.2-7-10V6l7-3z" />
      <path d="M8.7 12.2l2.1 2.1 4.8-5" />
    </svg>
  );
}

function SearchDocIcon() {
  return (
    <svg viewBox="0 0 160 160" aria-hidden="true">
      <rect x="28" y="32" width="104" height="96" rx="8" />
      <path d="M48 64h64M48 82h38M48 100h52" />
      <circle cx="113" cy="104" r="18" />
      <path d="M123 116l14 14" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10l5 5 5-5" />
    </svg>
  );
}
