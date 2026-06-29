// =============================================================================
// SINGLE SOURCE OF TRUTH — the draw, the scoring, the round map, name aliases.
// Edit point values here and the leaderboard recalculates everywhere.
// =============================================================================

// --- The draw (Restless office sweep). 16 players, 3 teams each. -------------
// P3 picks that were already knocked out had been scrubbed off the whiteboard
// and are unrecoverable — those are `null` (shown as an "already out" slot).
// Names are canonical; accents/spelling are normalised against the live feed.
export const DRAW = {
  "Zoe":      ["Morocco", "Nigeria", "Cabo Verde"],
  "Chloe":    ["England", "Denmark", null],
  "Greg":     ["Argentina", "Norway", null],
  "Oli":      ["Colombia", "Canada", null],
  "Will":     ["Croatia", "Peru", "Ghana"],
  "Nat":      ["Brazil", "Sweden", "Costa Rica"],
  "JV":       ["Belgium", "Senegal", null],
  "Nina":     ["Portugal", "Paraguay", null],
  "Jas":      ["Netherlands", "Switzerland", null],
  "Dickie":   ["Mexico", "Algeria", null],
  "Jaq":      ["France", "Australia", null],
  "Greg (2)": ["Germany", "Egypt", null],
  "Mark":     ["Uruguay", "Ecuador", null],
  "Trudy":    ["United States", "Korea Republic", null],
  "Emilia":   ["Japan", "Côte d'Ivoire", null],
  "Jamie":    ["Spain", "Türkiye", null],
};

// --- Points ------------------------------------------------------------------
export const POINTS = {
  match: { win: 3, draw: 1, loss: 0 },
  // Cumulative reach bonuses: you bank each as your team reaches that round.
  reach: {
    "round-of-32": 5,
    "round-of-16": 8,
    "quarterfinals": 13,
    "semifinals": 21,
    "final": 34,
  },
  champion: 55, // on top of reaching the final
};

// --- Round map: slug -> { order, label }. Order drives "furthest stage". ------
export const ROUNDS = {
  "group-stage":   { order: 0, label: "Group Stage",   short: "Group" },
  "round-of-32":   { order: 1, label: "Round of 32",   short: "R32" },
  "round-of-16":   { order: 2, label: "Round of 16",   short: "R16" },
  "quarterfinals": { order: 3, label: "Quarter-final", short: "QF" },
  "semifinals":     { order: 4, label: "Semi-final",    short: "SF" },
  "3rd-place-match": { order: 4, label: "Third Place",  short: "3rd" },
  "final":          { order: 5, label: "Final",         short: "Final" },
};

// Tournament window (UTC dates) used by the fetcher to sweep the scoreboard.
export const TOURNAMENT = {
  name: "FIFA World Cup 2026",
  start: "2026-06-11",
  end: "2026-07-19",
  espnLeague: "fifa.world",
};

// --- Name aliases: normalised live-feed name -> canonical draw name ----------
export const ALIASES = {
  "south korea": "Korea Republic",
  "korea republic": "Korea Republic",
  "republic of korea": "Korea Republic",
  "czech republic": "Czechia",
  "usa": "United States",
  "united states": "United States",
  "united states of america": "United States",
  "turkey": "Türkiye",
  "turkiye": "Türkiye",
  "cape verde": "Cabo Verde",
  "cabo verde": "Cabo Verde",
  "ivory coast": "Côte d'Ivoire",
  "cote divoire": "Côte d'Ivoire",
  "dr congo": "DR Congo",
  "congo dr": "DR Congo",
  "democratic republic of congo": "DR Congo",
  "bosnia herzegovina": "Bosnia and Herzegovina",
  "bosnia and herzegovina": "Bosnia and Herzegovina",
  "curacao": "Curaçao",
};
