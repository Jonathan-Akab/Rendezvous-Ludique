// Claude prices in USD per million tokens (Anthropic first-party API).
// Cache writes cost 1.25× input; cache reads are much cheaper.
// Unknown models are priced at the most expensive tier so budgets stay safe.

type Price = { input: number; output: number; cacheRead: number };

const PRICES: Record<string, Price> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1 },
};
const FALLBACK: Price = { input: 10, output: 50, cacheRead: 1 };

export type ClaudeUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** Price of a model; the API may answer with a dated id ("claude-haiku-4-5-20251001"). */
function priceOf(model: string) {
  return PRICES[model] ?? PRICES[model.replace(/-\d{8}$/, "")] ?? FALLBACK;
}

export function claudeCostUsd(model: string, u: ClaudeUsage) {
  const p = priceOf(model);
  const write = u.cache_creation_input_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  return (u.input_tokens * p.input + write * p.input * 1.25 + read * p.cacheRead + u.output_tokens * p.output) / 1_000_000;
}

/** Claude models that accept the effort setting and the server-side refusal fallback. */
export function supportsEffort(model: string) {
  return !model.startsWith("claude-haiku");
}
