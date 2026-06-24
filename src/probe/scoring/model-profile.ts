export interface ModelProfile {
  tier: "flagship" | "strong" | "standard" | "economy" | "unknown";
  expectedScore: number;
  label: string;
}

export function profileModel(model: string): ModelProfile {
  const normalized = model.toLowerCase();
  if (
    /fable-5|claude-fable-5|gpt-5\.5|gpt-5\.4(?!-(mini|nano))|gpt-5$|gpt-4\.1|gpt-4o|o3|o4|claude-4|claude-opus|claude-sonnet-4-6|gemini-3\.5|gemini-3\.1-pro|deepseek-reasoner|qwen3-max|qwen3\.7|qwen3\.5|kimi-k2\.(6|5)|glm-5\.2/.test(
      normalized
    )
  ) {
    return { tier: "flagship", expectedScore: 0.86, label: "旗舰模型" };
  }
  if (
    /gpt-5\.4-mini|claude-sonnet-4-5|claude-3\.7|claude-3\.5|gemini-3-flash|gemini-2\.5|deepseek-v4|deepseek-chat|qwen-plus|qwen3-32b|llama-4|grok-3|kimi-k2\b|glm-5/.test(
      normalized
    )
  ) {
    return { tier: "strong", expectedScore: 0.78, label: "强模型" };
  }
  if (/mini|flash|haiku|lite|small|qwen-turbo|gpt-4o-mini|gpt-4\.1-mini/.test(normalized)) {
    return { tier: "standard", expectedScore: 0.68, label: "标准模型" };
  }
  if (/nano|tiny|8b|7b|3b|1b/.test(normalized)) {
    return { tier: "economy", expectedScore: 0.56, label: "轻量模型" };
  }
  return { tier: "unknown", expectedScore: 0.7, label: "未知档位模型" };
}
