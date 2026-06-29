// =============================================================================
// Fetcher: sweep ESPN's keyless World Cup scoreboard across the whole tournament
// window and write public/data.json (raw matches + metadata). No API key needed.
// Run: node scripts/fetch.mjs
// =============================================================================
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TOURNAMENT } from "../public/config.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, "..", "public", "data.json");

const BASE = `https://site.api.espn.com/apis/site/v2/sports/soccer/${TOURNAMENT.espnLeague}/scoreboard`;

function* dateRange(start, end) {
  const d = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  while (d <= last) {
    yield d.toISOString().slice(0, 10).replace(/-/g, "");
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

function parseEvent(e) {
  const c = e.competitions && e.competitions[0];
  if (!c || !c.competitors) return null;
  const side = (ha) => {
    const x = c.competitors.find((t) => t.homeAway === ha) || {};
    const team = x.team || {};
    return {
      name: team.displayName || team.name || "",
      abbr: team.abbreviation || "",
      id: team.id || null,
      logo: team.logo || null,
      color: team.color ? `#${team.color}` : null,
      score: x.score ?? null,
      winner: x.winner === true ? true : x.winner === false ? false : null,
    };
  };
  const st = (e.status && e.status.type) || {};
  return {
    id: e.id,
    date: (e.date || "").slice(0, 10),
    kickoff: e.date || null,
    round: (e.season && e.season.slug) || "group-stage",
    state: st.state || "pre",           // pre | in | post
    completed: st.completed === true,
    detail: st.shortDetail || st.detail || "",
    name: e.name || "",
    home: side("home"),
    away: side("away"),
  };
}

async function fetchDate(yyyymmdd) {
  const url = `${BASE}?dates=${yyyymmdd}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "wc-sweepstake/1.0" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      return (j.events || []).map(parseEvent).filter(Boolean);
    } catch (err) {
      if (attempt === 2) {
        console.warn(`  ! ${yyyymmdd} failed: ${err.message}`);
        return [];
      }
      await sleep(800 * (attempt + 1));
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const byId = new Map();
  let dates = 0;
  for (const d of dateRange(TOURNAMENT.start, TOURNAMENT.end)) {
    const events = await fetchDate(d);
    for (const ev of events) byId.set(ev.id, ev);
    dates++;
    await sleep(120); // be polite to the API
  }
  const matches = [...byId.values()].sort(
    (a, b) => (a.kickoff || "").localeCompare(b.kickoff || "") || a.id.localeCompare(b.id)
  );
  const completed = matches.filter((m) => m.completed).length;
  const live = matches.filter((m) => m.state === "in").length;

  const out = {
    updated: new Date().toISOString(),
    tournament: TOURNAMENT.name,
    counts: { dates, matches: matches.length, completed, live },
    matches,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(
    `Wrote ${matches.length} matches (${completed} completed, ${live} live) across ${dates} dates -> public/data.json`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
