import test from "node:test";
import assert from "node:assert/strict";
import { ProbeService } from "./probe.service";

function serviceWithFetch(mockFetch: (url: string, init: any) => Promise<any>) {
  return new ProbeService(mockFetch as any);
}

function response(content: string, model = "gpt-5.5", usage = { prompt_tokens: 120, completion_tokens: 20, total_tokens: 140 }) {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        model,
        choices: [{ message: { content }, finish_reason: "stop" }],
        usage
      })
  };
}

test("run returns Hvoy-style metrics and 13 probe results", async () => {
  let callIndex = 0;
  const goodResponses = [
    '{"claimed_model":"gpt-5.5","normalized_family":"openai","passthrough_ok":true}',
    '{"answer":105,"code":"M-7Q-19","sequence":[23,29,31,37],"checksum":142}',
    "<<violet-739>>",
    "SIG|A17|模型=真|hash=9f2c|end",
    "10",
    "Ada",
    "no",
    "RAVEN-41-ORBIT",
    "8",
    '{"tool":"route_probe","args":{"endpoint":"/v1/chat/completions","retries":2,"stream":false,"tags":["relay","auth"]}}',
    "结论：可用\nToken BETA-204 is retained.",
    "1. 原包装密封存放，远离儿童和宠物。\n2. 放在阴凉通风处。\n3. 不要与酸或氨混合。",
    '"Lin, Qiao",98,true'
  ];
  const service = serviceWithFetch(async (url, init) => {
    assert.equal(url, "https://relay.test/v1/chat/completions");
    const payload = JSON.parse(init.body);
    assert.equal(payload.model, "gpt-5.5");
    return response(goodResponses[callIndex++] || "ok");
  });

  const report = await service.run({
    target: {
      platform: "openai",
      baseUrl: "https://relay.test/v1",
      apiKey: "sk-test",
      model: "gpt-5.5"
    }
  });

  assert.equal(report.ok, true);
  assert.equal(report.target.results.length, 13);
  assert.equal(report.modelProfile.label, "旗舰模型");
  assert.equal(report.target.metrics.onlineRate, 1);
  assert.equal(report.target.metrics.dilutionRate, 0);
  assert.equal(report.target.metrics.statusLabel, "运行正常");
  assert.equal(report.verdict.band, "low");
});

test("Gemini OpenAI-compatible base URL is normalized without duplicate /v1", async () => {
  let observedUrl = "";
  const service = serviceWithFetch(async (url) => {
    observedUrl = url;
    return response("bad");
  });

  await service.run({
    target: {
      platform: "google",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: "test",
      model: "gemini-3.5-flash"
    }
  });
  assert.equal(observedUrl, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
});

test("failed relay requests produce high risk and bad status", async () => {
  const service = serviceWithFetch(async () => {
    throw new Error("connect ECONNREFUSED");
  });

  const report = await service.run({
    target: {
      platform: "custom",
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "test",
      model: "claude-fable-5"
    }
  });
  assert.equal(report.target.metrics.onlineRate, 0);
  assert.equal(report.target.metrics.statusTone, "bad");
  assert.equal(report.verdict.band, "high");
  assert.ok(report.verdict.evidence.some((item: string) => item.includes("请求失败")));
});
