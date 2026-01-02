# Vercel AI Gateway Integration

This app uses Vercel's AI SDK with AI Gateway for all AI model requests.

## CRITICAL PATTERN

**NEVER create a client with `createOpenAI` or similar.** The AI SDK automatically routes through Vercel AI Gateway when you pass the model string directly.

```ts
import { generateText, generateObject, streamText } from "ai";

// ✅ CORRECT - Pass model string directly
const result = await generateText({
  model: "google/gemini-2.5-flash",  // or "openai/gpt-4o-mini", etc.
  prompt: "Describe this music...",
});

// ✅ CORRECT - Works with streamText too
const result = await streamText({
  model: "google/gemini-2.5-flash",
  messages: [...],
});

// ✅ CORRECT - Works with generateObject too
const result = await generateObject({
  model: "google/gemini-2.5-flash",
  schema: MySchema,
  prompt: "...",
});

// ❌ WRONG - Don't create clients
import { createOpenAI } from "@ai-sdk/openai";
const client = createOpenAI({ baseURL: "...", apiKey: "..." });
const model = client("google/gemini-2.5-flash");  // NO!

// ❌ WRONG - Don't use createOpenAI wrapper
const model = createOpenAI({ ... })("model-name");  // NO!
```

The model string format is `provider/model-name` (e.g., `"google/gemini-2.5-flash"`, `"openai/gpt-4o-mini"`). The AI SDK handles routing automatically when `AI_GATEWAY_API_KEY` is set in the environment.

## Setup

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Vercel AI Gateway API Key (required)
# Automatically set when deployed on Vercel
AI_GATEWAY_API_KEY=...

# Optional: Custom AI Gateway URL
# When deployed on Vercel, the gateway is automatically used
# VERCEL_AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/...
```

### Vercel AI Gateway

When deployed on Vercel, the AI Gateway is automatically used for all AI requests. This provides:

- **Unified API**: Single interface for multiple AI providers
- **Rate Limiting**: Built-in rate limiting and quota management
- **Cost Tracking**: Monitor usage across all providers
- **Caching**: Optional response caching for faster responses
- **Security**: Centralized API key management

## Usage

### API Routes

#### `/api/ai` - AI Prompting

**POST** - Streaming response
```typescript
const response = await fetch('/api/ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Generate an instrument intent...',
    model: 'google/gemini-2.5-flash', // Use full model string
    temperature: 0.7,
    systemPrompt: 'You are an expert...',
  }),
});
```

**PUT** - Non-streaming response
```typescript
const response = await fetch('/api/ai', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Generate an instrument intent...',
    model: 'google/gemini-2.5-flash',
  }),
});

const { text, usage } = await response.json();
```

#### `/api/recompile` - AI-Assisted Recompilation

```typescript
const response = await fetch('/api/recompile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    useAI: true,
    aiPrompt: 'Make the instrument brighter and more aggressive',
    inventory: inventoryData,
    model: 'google/gemini-2.5-flash', // Use full model string
  }),
});
```

## Local Development

For local development, the AI SDK will use direct API keys from environment variables. The AI Gateway is automatically used when deployed on Vercel.

## Available Models

Vercel AI Gateway supports these models (use the full string as-is). Organized by provider with descriptions:

### Google Gemini Models

**Fast/Cheap (Recommended for simple tasks):**
- `google/gemini-2.5-flash` - **Best default choice** - Fast, cheap, excellent for most tasks including text generation, analysis, and structured output. Great balance of speed and quality.
- `google/gemini-2.5-flash-lite` - Even faster and cheaper than flash, good for very simple tasks or high-volume use cases.
- `google/gemini-2.0-flash` - Previous generation flash model, still fast and capable.
- `google/gemini-2.0-flash-lite` - Lightweight version of 2.0 flash.

**Pro Models (Better quality, slower):**
- `google/gemini-2.5-pro` - Higher quality than flash, better for complex reasoning, analysis, and nuanced tasks. Slower but more capable.
- `google/gemini-3-flash` - Latest generation flash model with improved capabilities.
- `google/gemini-3-pro-preview` - Preview of next-gen pro model, best for complex tasks requiring deep understanding.

**Multimodal (Image + Text):**
- `google/gemini-2.5-flash-image` - Flash model with image understanding capabilities.
- `google/gemini-2.5-flash-image-preview` - Preview version with image support.
- `google/gemini-3-pro-image` - Pro model with advanced image understanding.

**Embeddings:**
- `google/gemini-embedding-001` - Text embeddings for semantic search and similarity.
- `google/text-embedding-005` - Advanced embedding model.
- `google/text-multilingual-embedding-002` - Multilingual embeddings.

**Image Generation:**
- `google/imagen-4.0-generate-001` - High-quality image generation.
- `google/imagen-4.0-fast-generate-001` - Faster image generation.
- `google/imagen-4.0-ultra-generate-001` - Highest quality image generation.

### OpenAI Models

**Fast/Cheap:**
- `openai/gpt-4o-mini` - Fast, cheap, good for most tasks. Excellent default OpenAI option.
- `openai/gpt-5-nano` - Smallest GPT-5 model, fastest and cheapest.
- `openai/gpt-5-mini` - Small GPT-5, good balance of speed and capability.
- `openai/gpt-4.1-mini` - Compact version of GPT-4.1.
- `openai/gpt-4.1-nano` - Smallest GPT-4.1 variant.
- `openai/gpt-5.1-instant` - Fast GPT-5.1 variant.

**Standard:**
- `openai/gpt-5` - Latest GPT-5, best general-purpose model. High quality but slower.
- `openai/gpt-5.2` - Updated GPT-5 with improvements.
- `openai/gpt-5-chat` - GPT-5 optimized for conversational tasks.
- `openai/gpt-5.2-chat` - Chat-optimized GPT-5.2.
- `openai/gpt-4o` - GPT-4 optimized, good balance of speed and quality.
- `openai/gpt-4.1` - Enhanced GPT-4 with better capabilities.
- `openai/gpt-4-turbo` - Fast GPT-4 variant.
- `openai/gpt-3.5-turbo` - Legacy fast model, still useful for simple tasks.
- `openai/gpt-3.5-turbo-instruct` - Instruction-tuned GPT-3.5.

**Pro/Advanced:**
- `openai/gpt-5-pro` - Most capable GPT-5, best for complex reasoning and analysis.
- `openai/gpt-5.2-pro` - Latest pro model with enhanced capabilities.

**Specialized:**
- `openai/gpt-5-codex` - Optimized for code generation and understanding.
- `openai/gpt-5.1-codex` - Updated codex model.
- `openai/gpt-5.1-codex-max` - Maximum capability codex model.
- `openai/gpt-5.1-codex-mini` - Fast codex variant.
- `openai/codex-mini` - Small code-focused model.

**Reasoning/Research:**
- `openai/o1` - Original reasoning model, good for step-by-step thinking.
- `openai/o3` - Advanced reasoning model with improved capabilities.
- `openai/o3-pro` - Pro reasoning model for complex problems.
- `openai/o3-mini` - Fast reasoning model.
- `openai/o3-deep-research` - Specialized for deep research tasks.
- `openai/o4-mini` - Latest reasoning model variant.
- `openai/gpt-5.1-thinking` - Thinking/reasoning variant of GPT-5.1.

**Open Source:**
- `openai/gpt-oss-20b` - Open source 20B parameter model.
- `openai/gpt-oss-120b` - Large open source model.
- `openai/gpt-oss-safeguard-20b` - Open source with safety features.

**Embeddings:**
- `openai/text-embedding-3-small` - Small embedding model.
- `openai/text-embedding-3-large` - Large embedding model.
- `openai/text-embedding-ada-002` - Legacy embedding model.

### Anthropic Claude Models

**Fast/Cheap:**
- `anthropic/claude-haiku-4.5` - Fast Claude model, good for simple tasks and high-volume use.
- `anthropic/claude-3.5-haiku` - Previous generation fast model.

**Standard:**
- `anthropic/claude-sonnet-4.5` - Balanced Claude model, good general-purpose choice.
- `anthropic/claude-sonnet-4` - Previous generation sonnet.
- `anthropic/claude-3.5-sonnet` - Legacy sonnet model.
- `anthropic/claude-3.7-sonnet` - Enhanced sonnet variant.

**Pro/Advanced:**
- `anthropic/claude-opus-4.5` - Most capable Claude, best for complex reasoning and analysis.
- `anthropic/claude-opus-4.1` - Previous generation opus.
- `anthropic/claude-opus-4` - Legacy opus model.
- `anthropic/claude-3-opus` - Older opus variant.

### xAI Grok Models

**Fast:**
- `xai/grok-4.1-fast-non-reasoning` - Fast Grok without reasoning overhead, best for simple tasks.
- `xai/grok-4.1-fast-reasoning` - Fast Grok with reasoning capabilities.
- `xai/grok-4-fast-non-reasoning` - Previous fast non-reasoning variant.
- `xai/grok-4-fast-reasoning` - Previous fast reasoning variant.
- `xai/grok-3-fast` - Fast Grok 3 variant.
- `xai/grok-3-mini-fast` - Fastest Grok option.

**Standard:**
- `xai/grok-4` - Standard Grok 4 model.
- `xai/grok-3` - Standard Grok 3 model.
- `xai/grok-3-mini` - Smaller Grok 3 variant.
- `xai/grok-2` - Previous generation Grok.
- `xai/grok-2-vision` - Grok 2 with vision capabilities.

**Code:**
- `xai/grok-code-fast-1` - Fast code generation model.

### Mistral Models

**Small/Fast:**
- `mistral/ministral-3b` - Very small 3B parameter model, fastest option.
- `mistral/ministral-8b` - Small 8B model, fast and efficient.
- `mistral/ministral-14b` - Medium-small model.
- `mistral/mistral-small` - Small general-purpose model.
- `mistral/devstral-small` - Small code-focused model.
- `mistral/devstral-small-2` - Updated small code model.
- `mistral/magistral-small` - Small specialized model.

**Standard:**
- `mistral/mistral-medium` - Balanced Mistral model.
- `mistral/mistral-large-3` - Large Mistral model with enhanced capabilities.
- `mistral/mistral-nemo` - Specialized Mistral variant.

**Code:**
- `mistral/codestral` - Code generation model.
- `mistral/codestral-embed` - Code embeddings.

**Multimodal:**
- `mistral/pixtral-12b` - Vision-language model.
- `mistral/pixtral-large` - Large vision-language model.

**Mixture of Experts:**
- `mistral/mixtral-8x22b-instruct` - Large MoE model.

**Embeddings:**
- `mistral/mistral-embed` - Text embeddings.

### DeepSeek Models

**Standard:**
- `deepseek/deepseek-v3` - General-purpose DeepSeek model.
- `deepseek/deepseek-v3.1` - Updated v3 variant.
- `deepseek/deepseek-v3.2` - Latest v3 variant.
- `deepseek/deepseek-v3.2-exp` - Experimental v3.2 variant.
- `deepseek/deepseek-v3.2-thinking` - Thinking/reasoning variant.
- `deepseek/deepseek-v3.1-terminus` - Specialized variant.

**Reasoning:**
- `deepseek/deepseek-r1` - Reasoning-focused model.

### Meta Llama Models

**Small:**
- `meta/llama-3.2-1b` - Tiny 1B model, fastest option.
- `meta/llama-3.2-3b` - Small 3B model.
- `meta/llama-3.1-8b` - Small 8B model.

**Medium:**
- `meta/llama-3.2-11b` - Medium 11B model.
- `meta/llama-3.1-70b` - Large 70B model.
- `meta/llama-3.2-90b` - Very large 90B model.
- `meta/llama-3.3-70b` - Updated 70B model.

**Latest:**
- `meta/llama-4-scout` - Latest generation scout model.
- `meta/llama-4-maverick` - Latest generation maverick model.

### Alibaba Qwen Models

**Standard:**
- `alibaba/qwen-3-14b` - Small Qwen model.
- `alibaba/qwen-3-30b` - Medium Qwen model.
- `alibaba/qwen-3-32b` - Medium-large Qwen model.
- `alibaba/qwen-3-235b` - Very large Qwen model.
- `alibaba/qwen3-max` - Maximum capability Qwen.
- `alibaba/qwen3-max-preview` - Preview of max model.

**Code:**
- `alibaba/qwen3-coder` - Code generation model.
- `alibaba/qwen3-coder-30b-a3b` - Large code model.
- `alibaba/qwen3-coder-plus` - Enhanced code model.

**Multimodal:**
- `alibaba/qwen3-vl-instruct` - Vision-language model.
- `alibaba/qwen3-vl-thinking` - Vision-language with reasoning.

**Reasoning:**
- `alibaba/qwen3-next-80b-a3b-instruct` - Large reasoning model.
- `alibaba/qwen3-next-80b-a3b-thinking` - Large thinking model.
- `alibaba/qwen3-235b-a22b-thinking` - Very large thinking model.

**Embeddings:**
- `alibaba/qwen3-embedding-0.6b` - Small embeddings.
- `alibaba/qwen3-embedding-4b` - Medium embeddings.
- `alibaba/qwen3-embedding-8b` - Large embeddings.

### ZAI GLM Models

- `zai/glm-4.5` - Standard GLM model.
- `zai/glm-4.5-air` - Lightweight GLM variant.
- `zai/glm-4.5v` - Vision-capable GLM.
- `zai/glm-4.6` - Updated GLM model.
- `zai/glm-4.6v` - Vision-capable GLM 4.6.
- `zai/glm-4.6v-flash` - Fast vision GLM.
- `zai/glm-4.7` - Latest GLM model.

### Moonshot AI Models

- `moonshotai/kimi-k2` - Standard Kimi model.
- `moonshotai/kimi-k2-0905` - Updated Kimi variant.
- `moonshotai/kimi-k2-turbo` - Fast Kimi variant.
- `moonshotai/kimi-k2-thinking` - Reasoning Kimi model.
- `moonshotai/kimi-k2-thinking-turbo` - Fast reasoning Kimi.

### Other Providers

**Amazon:**
- `amazon/nova-lite` - Lightweight Amazon model.
- `amazon/nova-micro` - Tiny Amazon model.
- `amazon/nova-pro` - Pro Amazon model.
- `amazon/nova-2-lite` - Updated lite model.
- `amazon/titan-embed-text-v2` - Text embeddings.

**Perplexity:**
- `perplexity/sonar` - Standard Sonar model.
- `perplexity/sonar-pro` - Pro Sonar model.
- `perplexity/sonar-reasoning` - Reasoning Sonar.
- `perplexity/sonar-reasoning-pro` - Pro reasoning Sonar.

**Voyage AI (Embeddings):**
- `voyage/voyage-3.5` - Standard embeddings.
- `voyage/voyage-3.5-lite` - Lightweight embeddings.
- `voyage/voyage-3-large` - Large embeddings.
- `voyage/voyage-code-2` - Code embeddings.
- `voyage/voyage-code-3` - Updated code embeddings.
- `voyage/voyage-finance-2` - Finance embeddings.
- `voyage/voyage-law-2` - Legal embeddings.

**Cohere:**
- `cohere/command-a` - Command model.
- `cohere/embed-v4.0` - Embeddings v4.

**Minimax:**
- `minimax/minimax-m2` - Standard Minimax model.
- `minimax/minimax-m2.1` - Updated Minimax.
- `minimax/minimax-m2.1-lightning` - Fast Minimax.

**Vercel:**
- `vercel/v0-1.0-md` - V0 markdown model.
- `vercel/v0-1.5-md` - Updated V0 markdown.

**Image Generation (BFL):**
- `bfl/flux-2-pro` - Pro image generation.
- `bfl/flux-2-flex` - Flexible image generation.
- `bfl/flux-2-max` - Maximum quality images.
- `bfl/flux-pro-1.0-fill` - Image inpainting.
- `bfl/flux-pro-1.1` - Standard image generation.
- `bfl/flux-pro-1.1-ultra` - Ultra quality images.
- `bfl/flux-kontext-pro` - Context-aware generation.
- `bfl/flux-kontext-max` - Maximum context images.

**Specialized:**
- `nvidia/nemotron-nano-9b-v2` - Small NVIDIA model.
- `nvidia/nemotron-nano-12b-v2-vl` - Vision-language NVIDIA model.
- `nvidia/nemotron-3-nano-30b-a3b` - Large NVIDIA model.
- `meituan/longcat-flash-chat` - Fast chat model.
- `meituan/longcat-flash-thinking` - Fast reasoning model.
- `xiaomi/mimo-v2-flash` - Fast Xiaomi model.
- `kwaipilot/kat-coder-pro-v1` - Code generation model.
- `inception/mercury-coder-small` - Small code model.
- `arcee-ai/trinity-mini` - Small specialized model.
- `morph/morph-v3-fast` - Fast Morph model.
- `morph/morph-v3-large` - Large Morph model.
- `stealth/sonoma-sky-alpha` - Alpha model.
- `stealth/sonoma-dusk-alpha` - Alpha variant.
- `prime-intellect/intellect-3` - Reasoning model.

## Recommended Models by Use Case

- **Default/General Purpose**: `google/gemini-2.5-flash` - Best balance of speed, cost, and quality
- **Fast/High Volume**: `google/gemini-2.5-flash-lite` or `openai/gpt-4o-mini`
- **Complex Reasoning**: `google/gemini-2.5-pro` or `openai/gpt-5-pro` or `anthropic/claude-opus-4.5`
- **Code Generation**: `openai/gpt-5-codex` or `mistral/codestral`
- **Structured Output**: `google/gemini-2.5-flash` (works great with `generateObject`)
- **Multimodal (Image)**: `google/gemini-2.5-flash-image` or `google/gemini-3-pro-image`
