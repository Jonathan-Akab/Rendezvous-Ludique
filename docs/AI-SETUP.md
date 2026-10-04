# Setting up the rules AI

The rules AI has two providers. Claude is the default; the free option takes over when
Claude is off, over budget or failing (if allowed in **Admin → Rules AI**).

## 1. Claude (paid, precise) — Anthropic

1. Go to <https://console.anthropic.com> and create an account (or sign in).
2. **Billing**: add a payment method and buy some credits (e.g. 10–20 USD to start).
3. **Spend limit** (recommended): in *Settings → Limits*, set a monthly spend limit for the
   organization — a safety net on top of the site's own budgets.
4. **API key**: in *Settings → API Keys*, click *Create Key*, name it (e.g. `rendezvous-ludique`)
   and copy it — it starts with `sk-ant-` and is shown only once.
5. Put it in the server's environment:
   - Local development: in `.env` → `ANTHROPIC_API_KEY="sk-ant-..."`
   - Docker: in `.env.production` → `ANTHROPIC_API_KEY="sk-ant-..."`
6. Restart the server (`npm run dev`, or `docker compose --env-file .env.production up -d`).
7. Check **Admin → Rules AI → Providers**: Claude should say *ready*.
8. Set your limits on the same page: site budget per month, default budget per member,
   questions per day, and per-member overrides.

Model choice (Admin → Modules → Rules AI): Opus 5.5 (best), Sonnet 5.5 (about half the cost),
Haiku 4.5 (cheapest).

## 2. Free option (less reliable) — Google Gemini free tier

1. Go to <https://aistudio.google.com> and sign in with a Google account.
2. Click *Get API key* → *Create API key* and copy it.
3. Put it in the server's environment:
   - Local: `.env` → `FREE_AI_API_KEY="..."`
   - Docker: `.env.production` → `FREE_AI_API_KEY="..."`
4. Restart the server.
5. In **Admin → Modules → Rules AI**, check the free option settings:
   - API URL: `https://generativelanguage.googleapis.com/v1beta/openai` (default)
   - Model: `gemini-2.5-flash` (default) — check the current free model names in AI Studio
     and update this field if Google has renamed it.
6. **Admin → Rules AI → Providers** should show the free option as *ready*.

Good to know: Google's free tier has rate limits, and its terms allow Google to use free-tier
prompts to improve its products. Members see this in the warning before switching.

### Other free or cheap providers

Any OpenAI-compatible endpoint works — change the URL, model and key:

| Provider | API URL | Notes |
|---|---|---|
| Groq | `https://api.groq.com/openai/v1` | Free tier, very fast, small token limits per minute |
| OpenRouter | `https://openrouter.ai/api/v1` | Models ending in `:free` cost nothing, daily limits |
| Ollama (local) | `http://localhost:11434/v1` | Free and private, needs a powerful server; no key needed |
