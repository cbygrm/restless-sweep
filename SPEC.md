# Last Squad Standing — World Cup 2026 Sweepstake Tracker

A phone-first web app that tracks a 24-player friends-and-family World Cup 2026
sweepstake. It auto-updates from live match results, runs a "Last Player Standing"
survival game, and ranks everyone on a Survival Points leaderboard from champion
down to the wooden spoon.

## The game

- 24 players, each owns **2 countries** (drawn from a hat — see `config.mjs` DRAW).
- A player is **ALIVE** while at least one of their countries is still in the tournament,
  and **OUT** when both are eliminated.
- Headline prize: **Last Player Standing**. Plus a full points leaderboard so there is a
  settled finishing order all the way down to the 🥄 wooden spoon. Ties share a rank.

## Survival Points (ranking engine)

Points accrue to each country and sum across a player's two teams.

- **Per match (all stages):** Win +3, Draw +1, Loss 0.
- **Progression bonuses (cumulative — you bank each round's bonus as you reach it):**
  - Reach Round of 32 (qualify from group): +5
  - Reach Round of 16: +8
  - Reach Quarter-final: +13
  - Reach Semi-final: +21
  - Reach Final: +34
  - Win the World Cup 🏆: +55
- A team "reaches" a round when it appears as a real team in a fixture of that round
  (ESPN seeds the bracket as teams qualify, so this is automatic).

All values live in `config.mjs` (`POINTS`) so they can be tweaked in one place.

## Alive / eliminated rules

A team is **eliminated** when:
- it loses a completed knockout match, OR
- the group stage is complete and it never reached the Round of 32.

Otherwise it is alive. During the group stage everyone is treated as alive
(mathematical group eliminations are ignored for simplicity — agreed acceptable).
A player is alive if at least one of their two teams is alive.

## Data source

ESPN's free, keyless hidden API:
`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD`

- Returns per-date scoreboards with team identity + logo, scores, live state
  (pre / in / post), and `season.slug` for the round.
- The fetcher (`scripts/fetch.mjs`) loops every date of the tournament window
  (2026-06-11 → 2026-07-19), dedupes by event id, and writes `public/data.json`
  (raw matches + metadata). No API key, no signup.

## Architecture

- **Fetcher** `scripts/fetch.mjs` — pulls ESPN, writes `public/data.json`. Run on a schedule.
- **Scoring** `public/scoring.mjs` — pure functions; computes the leaderboard from
  `data.json` + `config.mjs`. Shared, runs in the browser so the maths is transparent
  and recalculates live.
- **Config** `public/config.mjs` — the draw, point values, round map, team-name aliases.
  Single source of truth.
- **App** `public/index.html` + `app.js` + `styles.css` — themed, phone-first leaderboard.
  Reads `data.json`, recomputes in-browser, auto-refreshes.
- **Auto-update + hosting** — GitHub Actions cron refreshes `data.json` on a schedule
  and deploys the static site to GitHub Pages (free, shareable link, key-less source so
  nothing secret lives in the browser).

## Screen (v1)

- Header: tournament title, "X of 24 still standing" survivor counter, last-updated time.
- Leaderboard table: rank (+ ▲▼ vs previous matchday) · player · their 2 flags with
  alive/💀 status · Played, W-D-L, GF-GA-GD · teams left · furthest stage · **points** ·
  ALIVE/OUT badge.
- "Today's mover" (biggest points gain on the latest matchday) and "On the bubble"
  (players whose last surviving team plays next).
- Tap a player → detail: their 2 flags, results so far, next kickoff.
- World Cup 2026 (USA/Canada/Mexico) theming; confetti on a win, skull on elimination.

## Out of scope (v1)

- Group-stage standings tables, WhatsApp summary push, push notifications, login —
  deferred to phase 2.
