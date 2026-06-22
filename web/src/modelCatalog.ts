export interface ModelOption {
  id: string;
  label: string;
  tier: "旗舰" | "强力" | "标准" | "轻量";
}

export interface PlatformOption {
  id: string;
  name: string;
  baseUrl: string;
  accent: string;
  models: ModelOption[];
}

export const platforms: PlatformOption[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    accent: "#1f7a5a",
    models: [
      { id: "gpt-5.5", label: "GPT-5.5", tier: "旗舰" },
      { id: "gpt-5.5-pro", label: "GPT-5.5 Pro", tier: "旗舰" },
      { id: "gpt-5.4", label: "GPT-5.4", tier: "旗舰" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 mini", tier: "标准" },
      { id: "gpt-5.4-nano", label: "GPT-5.4 nano", tier: "轻量" },
      { id: "gpt-5", label: "GPT-5", tier: "强力" }
    ]
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "",
    accent: "#8b5e34",
    models: [
      { id: "claude-fable-5", label: "Claude Fable 5", tier: "旗舰" },
      { id: "claude-opus-4-8", label: "Claude Opus 4.8", tier: "旗舰" },
      { id: "claude-opus-4-7", label: "Claude Opus 4.7", tier: "旗舰" },
      { id: "claude-opus-4-6", label: "Claude Opus 4.6", tier: "旗舰" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tier: "旗舰" },
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", tier: "强力" }
    ]
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    accent: "#0f766e",
    models: [
      { id: "glm-5.2", label: "GLM 5.2", tier: "旗舰" },
      { id: "glm-5", label: "GLM 5", tier: "强力" },
      { id: "glm-4.6", label: "GLM 4.6", tier: "标准" }
    ]
  },
  {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    accent: "#2b68b8",
    models: [
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", tier: "旗舰" },
      { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro", tier: "旗舰" },
      { id: "gemini-3-flash", label: "Gemini 3 Flash", tier: "强力" },
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", tier: "轻量" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "强力" }
    ]
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    accent: "#4f61c9",
    models: [
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", tier: "强力" },
      { id: "deepseek-chat", label: "DeepSeek Chat", tier: "强力" },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner", tier: "旗舰" }
    ]
  },
  {
    id: "qwen",
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    accent: "#8c4bd6",
    models: [
      { id: "qwen3-max", label: "Qwen3 Max", tier: "旗舰" },
      { id: "qwen3-max-preview", label: "Qwen3 Max Preview", tier: "旗舰" },
      { id: "qwen-plus-latest", label: "Qwen Plus Latest", tier: "强力" },
      { id: "qwen-flash", label: "Qwen Flash", tier: "标准" },
      { id: "qwen3.5", label: "Qwen3.5", tier: "强力" }
    ]
  },
  {
    id: "moonshot",
    name: "Moonshot Kimi",
    baseUrl: "https://api.moonshot.ai/v1",
    accent: "#bd3f72",
    models: [
      { id: "kimi-k2.6", label: "Kimi K2.6", tier: "旗舰" },
      { id: "kimi-k2.5", label: "Kimi K2.5", tier: "旗舰" },
      { id: "kimi-k2", label: "Kimi K2", tier: "强力" },
      { id: "moonshot-v1-128k", label: "Moonshot v1 128K", tier: "强力" },
      { id: "moonshot-v1-32k", label: "Moonshot v1 32K", tier: "标准" }
    ]
  },
  {
    id: "custom",
    name: "自定义中转",
    baseUrl: "",
    accent: "#2f6f6a",
    models: [
      { id: "custom", label: "手动输入模型名", tier: "标准" }
    ]
  }
];

export function findPlatform(id: string) {
  return platforms.find((platform) => platform.id === id) || platforms[0];
}
