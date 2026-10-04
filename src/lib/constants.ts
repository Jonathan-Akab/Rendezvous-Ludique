// Allowed values for the string "enums" stored in the database.

export const ROLES = ["MEMBER", "MODERATOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const VISIBILITIES = ["PUBLIC", "MEMBERS", "FRIENDS", "PRIVATE"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const EVENT_KINDS = ["HOME_GAME", "GAME_NIGHT", "TOURNAMENT", "CONVENTION"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_VISIBILITIES = ["PUBLIC", "MEMBERS", "FRIENDS"] as const;

export const ATTENDEE_STATUSES = ["GOING", "MAYBE", "REQUESTED", "DECLINED"] as const;
export type AttendeeStatus = (typeof ATTENDEE_STATUSES)[number];

export const LIBRARY_GAME_STATUSES = ["OWNED", "WISHLIST", "FOR_TRADE", "PREORDERED"] as const;
export type LibraryGameStatus = (typeof LIBRARY_GAME_STATUSES)[number];

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

// Classic wooden meeple colours; members can also pick any custom hex.
export const MEEPLE_COLORS = [
  { key: "red", hex: "#c92a2a" },
  { key: "orange", hex: "#d9480f" },
  { key: "yellow", hex: "#f2b705" },
  { key: "green", hex: "#2b8a3e" },
  { key: "teal", hex: "#0c8599" },
  { key: "blue", hex: "#1c5fbf" },
  { key: "purple", hex: "#6741d9" },
  { key: "pink", hex: "#d6336c" },
  { key: "brown", hex: "#8a5a2b" },
  { key: "black", hex: "#212529" },
  { key: "white", hex: "#f1f3f5" },
  { key: "grey", hex: "#868e96" },
] as const;

// Themes. "system" follows the OS light/dark preference; the others are fixed palettes
// (see src/app/themes.css). Swatches are used by the theme pickers.
export const THEMES = [
  { key: "system", swatch: ["#f7f1e3", "#1d1a16", "#d9480f"] },
  { key: "light", swatch: ["#f7f1e3", "#fffaf0", "#d9480f"] },
  { key: "dark", swatch: ["#1d1a16", "#2a2520", "#f08c00"] },
  { key: "catan", swatch: ["#f4e3c1", "#c1440e", "#2f6b2f"] },
  { key: "anachrony", swatch: ["#0f1a24", "#1c2c3a", "#3fd0c9"] },
  { key: "merchants-cove", swatch: ["#13212b", "#7a4b23", "#e0b04a"] },
  { key: "wingspan", swatch: ["#f3efe2", "#8fb3a3", "#c26a3d"] },
  { key: "azul", swatch: ["#eef3fa", "#1d4e89", "#e8a33d"] },
  { key: "terraforming", swatch: ["#1e0f0b", "#7a2e1a", "#f2742b"] },
  { key: "carcassonne", swatch: ["#eef0dc", "#6f8f3a", "#a33b2c"] },
] as const;
export type ThemeKey = (typeof THEMES)[number]["key"];
export const THEME_KEYS = THEMES.map((t) => t.key) as ThemeKey[];

export const SESSION_COOKIE = "rl_session";
export const THEME_COOKIE = "rl_theme";
export const LOCALE_COOKIE = "NEXT_LOCALE";
