# Rendezvous Ludique

A web app for board game enthusiasts: announce home games and events (list or calendar), find
tables near you, manage your game library (**My Kallax**), track your plays with friends, rate games
with the site's own **meeple rating**, share rulebooks and ask the **rules AI** — in French and
English, with light/dark and board-game-inspired themes (Catan, Anachrony, Merchants Cove,
Wingspan, Azul, Terraforming Mars, Carcassonne), each with its own original illustration.

## Features at a glance

- **Game library** (`/games`): the site's own game database. When a member adds a game it becomes a
  catalogue entry; the next member typing its name gets it as a suggestion, with its info, cover and
  rating. Box art is generated when no cover is uploaded.
- **Meeple rating**: each member rates games 1–10; the site shows the average, the distribution and
  member reviews.
- **Rulebooks**: PDF uploads per game, served to signed-in members.
- **Rules AI** (`/ai`): pick a game and its rulebook (or upload it right there), ask questions.
  - **Claude** (default, `ANTHROPIC_API_KEY`): reads the whole PDF, cites pages. Paid per question,
    within limits set in **Admin → Rules AI**: a monthly budget for the site, a default monthly
    budget per member, questions per day, and per-member overrides (Claude + free, free only, no AI).
  - **Free option** (`FREE_AI_API_KEY`): any OpenAI-compatible endpoint — Google Gemini's free tier
    by default, or Groq, OpenRouter, a local Ollama. Less reliable: uses the rulebook's extracted
    text only. Members can switch to it (with a warning), and it takes over automatically when
    Claude is off, over budget or failing (if the admin allows it).
- **Bazar** (`/bazaar`): games for sale or trade, with photos and private buyer/seller messages.
- **Facebook groups** (`/facebook`): tabs linking to the community's Facebook groups (managed by admins).
- **Events calendar**, global search (`Ctrl/⌘ + K`), collapsible sidebar that each member can reorder
  (admins set the default order in Admin → Modules), editable play logs.
- **Theme & login pictures**: admins can upload their own pictures in Admin → Appearance.

Setting up the AI providers (paid and free): see [docs/AI-SETUP.md](docs/AI-SETUP.md).

## Stack

- **Next.js 16** (App Router, server actions) + **React 19** + **TypeScript**
- **Prisma 7** — SQLite locally, PostgreSQL in production (Docker)
- **Tailwind CSS 4** with theme tokens, **Motion** for animations, **next-intl** for FR/EN
- Cookie sessions (hashed tokens in the database), bcrypt passwords

## Getting started (local)

```bash
npm install
cp .env.example .env      # local dev values: SQLite path, first admin, demo data
npm run setup             # creates prisma/dev.db and seeds it
npm run dev               # http://localhost:3000
```

Sign in with the admin account defined in `.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).
With `SEED_DEMO_DATA="true"`, the seed also creates demo members (marie, julien, sophie, alex, lea —
password `DEMO_PASSWORD`), games, events, shared kallax and plays.

Useful scripts: `npm run db:studio` (browse the DB), `npm run db:push` (apply schema changes),
`npm run lint` (type check), `npm run build`.

On a fresh install without seeding, the **first account registered becomes admin**.

## Production (Docker + PostgreSQL)

```bash
cp .env.production.example .env.production   # set real passwords
docker compose --env-file .env.production up -d --build
```

The build switches the Prisma provider to PostgreSQL (`scripts/use-postgres.mjs`). On start, the
container syncs the schema (`prisma db push`) and makes sure the admin account exists.
Set `COOKIE_SECURE="false"` only if the site is served over plain HTTP. Uploaded covers and
rulebooks live in the `uploads` volume. Set `ANTHROPIC_API_KEY` to enable the rules AI.

## Architecture

```
src/
  app/
    (auth)/          login (/) and /register — animated meeple "game table"
    (member)/        member site: home, events, kallax, plays, friends, members/[username], settings
    admin/           admin console — its own shell and navigation
    moderation/      moderator console (placeholder)
    p/[username]     shareable public profile
  modules/           one folder per feature module
    registry.ts      module manifests: nav entry + admin-tunable settings
    events/ games/ kallax/ plays/ friends/ ai/ bazaar/ facebook/ profiles/ donations/ auth/ admin/ preferences/
      service.ts     queries and domain rules
      actions.ts     server actions (each re-checks auth and module state)
      components/    UI for the module
  lib/               db, auth/session, settings, module state, time zone helpers
  components/        shared UI: Meeple, forms, motion helpers, nav shell
messages/            fr.json / en.json
prisma/              schema.prisma, seed.ts
```

### Roles and interfaces

Roles are `MEMBER`, `MODERATOR`, `ADMIN`. Everyone uses the same member site. Special rights never
change it: admins and moderators reach their consoles only from **Special access** in the account
menu (`/admin`, `/moderation`), each with its own layout.

### Modules

Every feature is a module declared in `src/modules/registry.ts`. The admin console
(**Admin → Modules**) is generated from that list: each module can be switched off (its pages
return 404 and disappear from the navigation) and its settings tuned (radius, sharing limits,
friend confirmation, donation URL…). To add a module:

1. Create `src/modules/<key>/` (service, actions, components).
2. Add its manifest (icon, nav link, settings with defaults) to `registry.ts`.
3. Add its pages under `src/app/(member)/<key>/` and call `requireModule("<key>")` at the top.
4. Add labels to `messages/en.json` and `messages/fr.json` (`nav.<key>`, `admin.modules.*`).

### What admins control

Members (roles, suspension, profile fields, password reset, sessions, deletion), games & events
(edit, cancel, delete), the shared game catalogue (edit, merge duplicates, delete), kallax libraries,
plays, modules, themes (which are offered + default), site settings (name, default language, time
zone, announcement banner, open/closed registration) and an audit log of admin actions.

### Privacy

- Profile visibility: public link / members / friends / only me; kallax and plays can be hidden.
- Home-game addresses are only shown to the host and confirmed players.
- Locations are stored rounded to ~1 km and only used for "near me" searches.
- Plays logged with friends only appear in their log after they accept.
