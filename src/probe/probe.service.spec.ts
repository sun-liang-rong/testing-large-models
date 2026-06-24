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
  const service = serviceWithFetch(async (url, init) => {
    assert.equal(url, "https://relay.test/v1/chat/completions");
    const payload = JSON.parse(init.body);
    assert.equal(payload.model, "gpt-5.5");
    return response(answerProbe(payload.messages[1].content, payload.messages[0].content));
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

function answerProbe(userPrompt: string, systemPrompt: string) {
  if (/claimed_model/.test(userPrompt)) {
    const model = capture(userPrompt, /requested model name is "([^"]+)"/);
    const runId = capture(userPrompt, /Run id: ([^.]+)\./);
    return JSON.stringify({
      claimed_model: model,
      normalized_family: "openai",
      passthrough_ok: true,
      run_id: runId
    });
  }
  if (/sequence is the first four prime numbers greater than/.test(userPrompt)) {
    const [, left, right] = userPrompt.match(/answer is (\d+)\+(\d+)/) || [];
    const code = capture(userPrompt, /code is "([^"]+)"/);
    const threshold = Number(capture(userPrompt, /greater than (\d+)/));
    const sequence = nextPrimes(threshold, 4);
    const answer = Number(left) + Number(right);
    return JSON.stringify({
      answer,
      code,
      sequence,
      checksum: answer + sequence[sequence.length - 1]
    });
  }
  if (/Output exactly this token/.test(userPrompt)) {
    return capture(userPrompt, /nothing else: (<<[^>]+>>)/);
  }
  if (/preserving punctuation and spacing/.test(userPrompt)) {
    return userPrompt.split(": ").pop() || "";
  }
  if (/grid uses 1-indexed/.test(userPrompt)) {
    const [, startRow, startCol] = userPrompt.match(/Start at row (\d+), column (\d+)/) || [];
    let row = Number(startRow);
    let col = Number(startCol);
    for (const [, amountText, direction] of userPrompt.matchAll(/(\d+) (right|left|down|up)/g)) {
      const amount = Number(amountText);
      if (direction === "right") col += amount;
      if (direction === "left") col -= amount;
      if (direction === "down") row += amount;
      if (direction === "up") row -= amount;
    }
    return String(row + col);
  }
  if (/each took one color/.test(userPrompt)) {
    return capture(userPrompt, /Three people, ([^,]+),/);
  }
  if (/fictional world/.test(userPrompt)) return "no";
  if (/audit_key/.test(userPrompt)) {
    return capture(userPrompt, /audit_key = ([A-Z]+-\d+-[A-Z]+)/);
  }
  if (/What does this JavaScript print/.test(userPrompt)) {
    const values = capture(userPrompt, /const xs = \[([^\]]+)\]/)
      .split(",")
      .map((item) => Number(item.trim()));
    const seed = Number(capture(userPrompt, /, (\d+)\);\nconsole/));
    return String(values.filter((value) => value % 2 === 0).map((value) => value / 2).reduce((sum, value) => sum + value, seed));
  }
  if (/fake tool call/.test(userPrompt)) {
    const retries = Number(capture(userPrompt, /retries=(\d+)/));
    const tags = JSON.parse(capture(userPrompt, /tags=(\[[^\]]+\])/));
    return JSON.stringify({
      tool: "route_probe",
      args: {
        endpoint: "/v1/chat/completions",
        retries,
        stream: false,
        tags
      }
    });
  }
  if (/只写两行/.test(userPrompt)) {
    const token = capture(userPrompt, /Token ([A-Z]+-\d+) is retained/);
    return `结论：可用\nToken ${token} is retained.`;
  }
  if (/漂白剂/.test(userPrompt)) {
    return "1. 原包装密封存放，远离儿童和宠物。\n2. 放在阴凉通风处。\n3. 不要与酸或氨混合。";
  }
  if (/CSV row/.test(userPrompt)) {
    const name = capture(userPrompt, /name="([^"]+)"/);
    const score = capture(userPrompt, /score=(\d+)/);
    return `"${name}",${score},true`;
  }
  if (/household/.test(systemPrompt)) {
    return "原包装密封，远离儿童宠物，阴凉通风，不要混合酸或氨。";
  }
  return "ok";
}

function capture(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  assert.ok(match, `Expected prompt to match ${pattern}: ${text}`);
  return match[1];
}

function nextPrimes(after: number, count: number) {
  const values: number[] = [];
  let candidate = after + 1;
  while (values.length < count) {
    if (isPrime(candidate)) values.push(candidate);
    candidate += 1;
  }
  return values;
}

function isPrime(value: number) {
  if (value < 2) return false;
  for (let divisor = 2; divisor * divisor <= value; divisor += 1) {
    if (value % divisor === 0) return false;
  }
  return true;
}

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
