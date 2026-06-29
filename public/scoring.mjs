// =============================================================================
// Pure scoring engine. Runs in the browser AND node. No side effects.
// computeLeaderboard(matches, config) -> { players, meta }
// =============================================================================
import { DRAW, POINTS, ROUNDS, ALIASES } from "./config.mjs";

// Normalise a country name: lowercase, strip accents & punctuation, collapse space.
export function norm(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Build a lookup from normalised name -> canonical draw country (once).
function buildResolver() {
  const canonByNorm = {};
  for (const teams of Object.values(DRAW)) {
    for (const c of teams) if (c) canonByNorm[norm(c)] = c;
  }
  const aliasByNorm = {};
  for (const [k, v] of Object.entries(ALIASES)) aliasByNorm[norm(k)] = v;
  return (name) => {
    const n = norm(name);
    return aliasByNorm[n] || canonByNorm[n] || null;
  };
}
const resolve = buildResolver();

// Resolve a live-feed team name to a canonical drawn country (or null). Exported
// so the UI can match fixtures/results to players.
export function resolveCountry(name) {
  return resolve(name);
}

// Owner of a canonical country.
const OWNER = (() => {
  const m = {};
  for (const [player, teams] of Object.entries(DRAW)) {
    for (const c of teams) if (c) m[c] = player;
  }
  return m;
})();

export function ownerOf(country) {
  return OWNER[country] || null;
}

function roundOrder(slug) {
  return ROUNDS[slug] ? ROUNDS[slug].order : 0;
}

// Main computation.
export function computeLeaderboard(matches, opts = {}) {
  const points = opts.points || POINTS;

  // Per-country accumulator.
  const teams = {};
  const appeared = new Set(); // canonical countries that show up in the live feed
  const team = (c) =>
    (teams[c] ||= {
      country: c, owner: OWNER[c], logo: null, abbr: null,
      P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0,
      reachOrder: 0, eliminated: false, champion: false,
      matchPts: 0, todayPts: 0,
    });

  // Is the group stage finished? (no group game still pending)
  const groupGames = matches.filter((m) => (m.round || "group-stage") === "group-stage");
  const groupStageComplete =
    groupGames.length > 0 && groupGames.every((m) => m.completed);

  // Latest date on which a completed match exists -> "today" for the mover stat.
  const latestDate = matches
    .filter((m) => m.completed)
    .map((m) => m.date)
    .sort()
    .pop() || null;

  for (const m of matches) {
    const round = m.round || "group-stage";
    const order = roundOrder(round);
    const sides = [m.home, m.away];
    const resolved = sides.map((s) => s && resolve(s.name));

    // Reaching a knockout round = appearing as a real team in a CONFIRMED fixture.
    // ESPN pre-seeds the bracket with projected teams during the group stage, so we
    // ignore knockout appearances until the group stage is actually complete; after
    // that, a team only appears in a round once it has genuinely qualified for it.
    sides.forEach((s, i) => {
      const c = resolved[i];
      if (!c) return;
      appeared.add(c);
      const t = team(c);
      if (s.logo && !t.logo) t.logo = s.logo;
      if (s.abbr && !t.abbr) t.abbr = s.abbr;
      const confirmed = order === 0 || groupStageComplete;
      if (confirmed && order > t.reachOrder) t.reachOrder = order;
    });

    if (!m.completed) continue;
    const [hc, ac] = resolved;
    const h = m.home, a = m.away;

    // Tally completed match for any of our teams involved.
    const apply = (c, gf, ga, isWinner) => {
      if (!c) return;
      const t = team(c);
      t.P++; t.GF += gf; t.GA += ga;
      let pts;
      if (gf === ga && order === 0) { t.D++; pts = points.match.draw; }
      else if (isWinner) { t.W++; pts = points.match.win; }
      else { t.L++; pts = points.match.loss; }
      t.matchPts += pts;
      if (m.date === latestDate) t.todayPts += pts;
    };
    const hs = num(h.score), as = num(a.score);
    apply(hc, hs, as, h.winner === true || (hs > as));
    apply(ac, as, hs, a.winner === true || (as > hs));

    // Knockout loss => eliminated. Champion => winner of completed final.
    if (order >= 1) {
      if (hc && h.winner === false) team(hc).eliminated = true;
      if (ac && a.winner === false) team(ac).eliminated = true;
      if (round === "final") {
        if (hc && h.winner === true) team(hc).champion = true;
        if (ac && a.winner === true) team(ac).champion = true;
      }
    }
  }

  // Make sure every drawn team has an entry, and flag any that aren't actually
  // in the tournament's live field (drafted but never appears in any fixture).
  for (const c of Object.values(DRAW).flat()) {
    if (!c) continue;
    const t = team(c);
    t.notInTournament = !appeared.has(c);
  }

  // Bonuses + final elimination + total points per team.
  for (const t of Object.values(teams)) {
    let bonus = 0;
    for (const [slug, val] of Object.entries(points.reach)) {
      if (t.reachOrder >= ROUNDS[slug].order) bonus += val;
    }
    if (t.champion) bonus += points.champion;
    t.bonusPts = bonus;
    t.points = t.matchPts + bonus;
    // Group-stage non-qualifier: out once the group stage is done.
    if (!t.eliminated && groupStageComplete && t.reachOrder < 1) t.eliminated = true;
    if (t.notInTournament) t.eliminated = true; // never in the field at all
    if (t.champion) t.eliminated = false;
    t.alive = !t.eliminated;
    t.furthest = t.reachOrder;
  }

  // A scrubbed-out / unknown P3 pick: a slot we know was eliminated but can't name.
  const placeholderTeam = () => ({
    country: null, unknown: true, owner: null, logo: null, abbr: null,
    P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0,
    reachOrder: 0, furthest: 0, eliminated: true, alive: false, champion: false,
    matchPts: 0, bonusPts: 0, points: 0, todayPts: 0, notInTournament: false,
  });

  // Aggregate to players (everyone in the draw, even 0-point teams).
  const players = Object.entries(DRAW).map(([name, countries]) => {
    const cts = countries.map((c) => (c ? team(c) : placeholderTeam()));
    const sum = (k) => cts.reduce((s, t) => s + t[k], 0);
    const alive = cts.some((t) => t.alive);
    return {
      name,
      teams: cts,
      P: sum("P"), W: sum("W"), D: sum("D"), L: sum("L"),
      GF: sum("GF"), GA: sum("GA"), GD: sum("GF") - sum("GA"),
      points: sum("points"),
      todayPts: sum("todayPts"),
      teamsRemaining: cts.filter((t) => t.alive).length,
      furthest: Math.max(...cts.map((t) => t.furthest)),
      alive,
      champion: cts.some((t) => t.champion),
    };
  });

  // Rank: points desc, then GD, then GF as soft tiebreaks for display order;
  // but SHARED rank is by points only (ties share a rank, as agreed).
  players.sort((a, b) =>
    b.points - a.points || b.GD - a.GD || b.GF - a.GF || a.name.localeCompare(b.name)
  );
  let lastPts = null, lastRank = 0;
  players.forEach((p, i) => {
    if (p.points !== lastPts) { lastRank = i + 1; lastPts = p.points; }
    p.rank = lastRank;
  });
  const maxRank = players.length ? players[players.length - 1].rank : 0;
  players.forEach((p) => { p.woodenSpoon = p.rank === maxRank && maxRank > 1; });

  const survivors = players.filter((p) => p.alive).length;
  return {
    players,
    meta: {
      survivors,
      total: players.length,
      groupStageComplete,
      latestDate,
      champion: players.find((p) => p.champion)?.name || null,
    },
  };
}

function num(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}
