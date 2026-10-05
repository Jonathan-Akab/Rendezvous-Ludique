// Feature-module registry.
//
// Every feature of the member site is a module. A module declares:
//  - where it lives in the member navigation (if anywhere),
//  - the settings an admin can tune, with their defaults.
// The admin console renders toggles and settings forms straight from this list, and
// `requireModule()` hides a module's pages when an admin turns it off. To add a module:
// create src/modules/<key>/, add its manifest here, add its labels to messages/*.json.

export type SettingField =
  | { key: string; type: "boolean"; default: boolean }
  | { key: string; type: "number"; default: number; min?: number; max?: number; decimal?: boolean }
  | { key: string; type: "string"; default: string }
  | { key: string; type: "url"; default: string }
  | { key: string; type: "select"; default: string; options: readonly string[] };

export type ModuleManifest = {
  key: ModuleKey;
  /** lucide icon name, resolved in src/components/icons.tsx */
  icon: string;
  /** member navigation entry; omit for modules without a page */
  href?: string;
  /** core modules cannot be disabled */
  core?: boolean;
  settings: SettingField[];
};

export type ModuleKey = "events" | "games" | "kallax" | "plays" | "friends" | "ai" | "bazaar" | "facebook" | "profiles" | "donations" | "suggestions" | "picker";

export const MODULES: ModuleManifest[] = [
  {
    key: "events",
    icon: "CalendarDays",
    href: "/events",
    settings: [
      { key: "allowPublicEvents", type: "boolean", default: true },
      { key: "defaultRadiusKm", type: "number", default: 50, min: 1, max: 1000 },
      { key: "maxPlayersCap", type: "number", default: 100, min: 2, max: 10000 },
    ],
  },
  {
    key: "games",
    icon: "Boxes",
    href: "/games",
    settings: [
      { key: "membersCanAddGames", type: "boolean", default: true },
      { key: "communityEditing", type: "boolean", default: true },
      { key: "allowCoverUploads", type: "boolean", default: true },
      { key: "allowRulebookUploads", type: "boolean", default: true },
      { key: "imageSearch", type: "select", default: "auto", options: ["auto", "bgg", "wikimedia", "none"] },
      // the free AI completes games added to a Kallax (details + a verified box picture)
      { key: "autoEnrich", type: "boolean", default: true },
    ],
  },
  {
    key: "kallax",
    icon: "LibraryBig",
    href: "/kallax",
    settings: [
      { key: "allowSharing", type: "boolean", default: true },
      { key: "maxSharedMembers", type: "number", default: 4, min: 1, max: 20 },
    ],
  },
  {
    key: "plays",
    icon: "Dices",
    href: "/plays",
    settings: [
      { key: "requireConfirmation", type: "boolean", default: true },
      { key: "allowGuests", type: "boolean", default: true },
    ],
  },
  {
    key: "friends",
    icon: "Users",
    href: "/friends",
    settings: [{ key: "allowRequests", type: "boolean", default: true }],
  },
  {
    key: "ai",
    icon: "Sparkles",
    href: "/ai",
    settings: [
      // Claude (default, precise, paid per question)
      { key: "claudeEnabled", type: "boolean", default: true },
      { key: "model", type: "select", default: "claude-opus-5-5", options: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"] },
      { key: "effort", type: "select", default: "medium", options: ["low", "medium", "high", "xhigh", "max"] },
      { key: "monthlyBudgetUsd", type: "number", default: 20, min: 0, max: 100000, decimal: true },
      { key: "memberMonthlyBudgetUsd", type: "number", default: 2, min: 0, max: 10000, decimal: true },
      { key: "dailyQuestionLimit", type: "number", default: 40, min: 1, max: 1000 },
      { key: "allowGeneralKnowledge", type: "boolean", default: true },
      { key: "allowOwnKeys", type: "boolean", default: true },
      // Free option (less reliable): any OpenAI-compatible chat endpoint
      { key: "freeEnabled", type: "boolean", default: true },
      { key: "autoFallbackToFree", type: "boolean", default: true },
      { key: "freeProviderName", type: "string", default: "Google Gemini" },
      { key: "freeBaseUrl", type: "url", default: "https://generativelanguage.googleapis.com/v1beta/openai" },
      { key: "freeModel", type: "string", default: "gemini-3.8-flash" },
      // background tasks (completing games, photos): a lite model with a larger free quota
      { key: "freeTaskModel", type: "string", default: "gemini-3.1-flash-lite" },
      { key: "freeMaxContextChars", type: "number", default: 80000, min: 4000, max: 2000000 },
      // Rules FAQ, built from the questions members ask
      { key: "faqEnabled", type: "boolean", default: true },
      { key: "faqAutoPublish", type: "boolean", default: true },
    ],
  },
  {
    key: "bazaar",
    icon: "Store",
    href: "/bazaar",
    settings: [
      { key: "allowTrades", type: "boolean", default: true },
      { key: "currency", type: "string", default: "CAD" },
      { key: "maxPhotos", type: "number", default: 6, min: 0, max: 12 },
    ],
  },
  {
    key: "facebook",
    icon: "Facebook",
    href: "/facebook",
    settings: [],
  },
  {
    key: "suggestions",
    icon: "Lightbulb",
    href: "/suggestions",
    settings: [{ key: "showToMembers", type: "boolean", default: true }],
  },
  {
    key: "profiles",
    icon: "UserRound",
    core: true,
    settings: [{ key: "allowPublicProfiles", type: "boolean", default: true }],
  },
  {
    // "Coup de dé": which game to play, a draw from a list, the first player
    key: "picker",
    icon: "Dices",
    href: "/picker",
    settings: [],
  },
  {
    key: "donations",
    icon: "Heart",
    settings: [
      { key: "url", type: "url", default: "" },
      { key: "transferEmail", type: "string", default: "jonathan-boisvert@outlook.com" },
      { key: "showInHeader", type: "boolean", default: true },
      { key: "showInFooter", type: "boolean", default: true },
    ],
  },
];

/** Default menu order on a fresh install (admins can change it in Admin → Modules). */
export const DEFAULT_MENU_ORDER: ModuleKey[] = ["events", "plays", "kallax", "picker", "ai", "friends", "games", "bazaar", "facebook", "suggestions", "profiles", "donations"];

export function getManifest(key: ModuleKey) {
  const m = MODULES.find((mod) => mod.key === key);
  if (!m) throw new Error(`Unknown module: ${key}`);
  return m;
}

export function defaultSettings(key: ModuleKey) {
  return Object.fromEntries(getManifest(key).settings.map((s) => [s.key, s.default]));
}
