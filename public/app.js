import { computeLeaderboard, resolveCountry, ownerOf } from "./scoring.mjs";
import { ROUNDS } from "./config.mjs";

const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

let DATA = null;   // raw data.json
let MODEL = null;  // computed leaderboard
const MEDALS = { 1: "gold", 2: "silver", 3: "bronze" };
const MEDAL_ICON = { 1: "🥇", 2: "🥈", 3: "🥉" };

async function load() {
  const res = await fetch("./data.json?_=" + Date.now());
  DATA = await res.json();
  MODEL = computeLeaderboard(DATA.matches);
  render();
}

function render() {
  renderBanner();
  renderRail();
  renderBoard();
  renderSchedule();
  renderFooter();
  if (MODEL.meta.champion) celebrate();
}

/* ---- Survivor banner ----------------------------------------------------- */
function renderBanner() {
  const { survivors, total } = MODEL.meta;
  $("#survCount").textContent = survivors;
  $("#survOf").textContent = survivors + "/" + total;
  $("#survFill").style.width = (survivors / total) * 100 + "%";
}

/* ---- Highlight rail ------------------------------------------------------- */
function renderRail() {
  const rail = $("#rail");
  rail.innerHTML = "";
  const players = MODEL.players;
  const leader = players[0];
  const spoon = [...players].reverse().find((p) => p.woodenSpoon) || players[players.length - 1];
  const mover = [...players].filter((p) => p.todayPts > 0).sort((a, b) => b.todayPts - a.todayPts)[0];
  const next = nextFixtures(2);

  rail.append(chip("lead", "🏆", "Leader", leader.name, leader.points + " pts", "🏆"));

  if (mover) rail.append(chip("mover", "📈", "Today's mover", mover.name, "+" + mover.todayPts + " pts today", "📈"));

  next.forEach((m) => {
    const ho = teamTag(m.home.name), ao = teamTag(m.away.name);
    rail.append(chip("next", "⏭", "Next up · " + kickoffLabel(m), `${flagName(m.home)} v ${flagName(m.away)}`, `${ho} vs ${ao}`, "⚽"));
  });

  rail.append(chip("spoon", "🥄", "Wooden spoon", spoon.name, spoon.points + " pts", "🥄"));
}
function chip(kind, ico, k, v, sub, accent) {
  const c = el("div", "chip " + kind);
  c.append(el("div", "chip-k", `${ico} ${esc(k)}`));
  c.append(el("div", "chip-v", esc(v)));
  if (sub) c.append(el("div", "chip-sub", esc(sub)));
  if (accent) c.append(el("div", "chip-accent", accent));
  return c;
}
function teamTag(name) {
  const c = resolveCountry(name);
  const o = c && ownerOf(c);
  return o ? o + "’s " + c : name;
}
function flagName(side) { return side.abbr || side.name; }

/* ---- Leaderboard --------------------------------------------------------- */
function renderBoard() {
  const board = $("#board");
  board.innerHTML = "";
  MODEL.players.forEach((p, i) => {
    const card = el("div", "player " + (p.alive ? "" : "out ") + (MEDALS[p.rank] || ""));
    card.style.animationDelay = Math.min(i * 35, 600) + "ms";
    card.onclick = () => openPlayer(p);

    const rank = el("div", "rank", `${p.rank}${p.woodenSpoon ? "<small>SPOON</small>" : ""}`);

    const who = el("div", "who");
    const medal = MEDAL_ICON[p.rank] ? `<span class="medal">${MEDAL_ICON[p.rank]}</span>` : (p.woodenSpoon ? `<span class="medal">🥄</span>` : "");
    who.append(el("div", "pname", `${esc(p.name)}${medal}`));
    const teams = el("div", "teams");
    p.teams.forEach((t) => teams.append(teamPill(t)));
    who.append(teams);
    who.append(statline(p));

    const score = el("div", "score-col");
    score.append(el("div", "pts", `${p.points}<span>PTS</span>`));
    score.append(el("div", "badge " + (p.alive ? "alive" : "out"), p.alive ? "Alive" : "Out"));
    if (p.todayPts > 0) score.append(el("div", "today", "+" + p.todayPts + " today"));

    card.append(rank, who, score);
    board.append(card);
  });
}
function teamPill(t) {
  if (t.unknown) { // scrubbed-out P3 pick
    const pill = el("span", "team dead ghost");
    pill.title = "This P3 team was knocked out and scrubbed off the whiteboard";
    pill.innerHTML = `<span class="flag"></span>P3 out<span class="skull">💀</span>`;
    return pill;
  }
  const pill = el("span", "team " + (t.alive ? "" : "dead"));
  if (t.notInTournament) pill.title = "Not in the 2026 World Cup field — scores nothing";
  const flag = t.logo ? `<img class="flag" src="${esc(t.logo)}" alt="" loading="lazy">` : `<span class="flag"></span>`;
  const rec = t.notInTournament ? `<span class="mono nf">n/a</span>` : `<span class="mono">${t.W}-${t.D}-${t.L}</span>`;
  const dead = t.alive ? "" : `<span class="skull">💀</span>`;
  pill.innerHTML = `${flag}${esc(t.country)} ${rec}${dead}`;
  return pill;
}
function statline(p) {
  const gdCls = p.GD > 0 ? "gd-pos" : p.GD < 0 ? "gd-neg" : "";
  const gd = (p.GD > 0 ? "+" : "") + p.GD;
  const stage = p.furthest > 0 ? ` · <b>${stageLabel(p.furthest)}</b>` : "";
  const total = p.teams.length;
  const alive = p.teamsRemaining < total ? ` · <b>${p.teamsRemaining}/${total}</b> alive` : "";
  return el("div", "statline",
    `P <b>${p.P}</b> · <b>${p.W}</b>W <b>${p.D}</b>D <b>${p.L}</b>L · GD <b class="${gdCls}">${gd}</b>${alive}${stage}`);
}
function stageLabel(order) {
  const r = Object.values(ROUNDS).find((x) => x.order === order);
  return r ? r.short : "Group";
}

/* ---- Player detail modal -------------------------------------------------- */
function openPlayer(p) {
  const card = $("#modalCard");
  card.innerHTML = "";
  const head = el("div", "m-head");
  head.append(el("div", "m-name", esc(p.name)));
  const close = el("button", "m-close", "✕");
  close.onclick = closeModal;
  head.append(close);
  card.append(head);

  const meta = el("div", "m-meta");
  meta.append(el("div", "m-pill", `Rank <b>#${p.rank}</b>${p.woodenSpoon ? " 🥄" : ""}`));
  meta.append(el("div", "m-pill", `<b>${p.points}</b> pts`));
  meta.append(el("div", "m-pill", p.alive ? `🟢 Alive · ${p.teamsRemaining}/${p.teams.length}` : "💀 Knocked out"));
  meta.append(el("div", "m-pill", `Furthest <b>${stageLabel(p.furthest)}</b>`));
  card.append(meta);

  p.teams.forEach((t) => card.append(teamBlock(t)));

  $("#modal").hidden = false;
  document.body.style.overflow = "hidden";
}
function teamBlock(t) {
  const wrap = el("div", "m-team");

  if (t.unknown) { // scrubbed-out P3 pick
    wrap.append(el("div", "m-team-head",
      `<span class="nm">Third pick — already out</span>` +
      `<span class="st" style="background:#2a3658;color:#9aa3bd">OUT 💀</span>`));
    wrap.append(el("div", "m-note", "This P3 team had already been knocked out and was scrubbed off the whiteboard, so it can't be tracked."));
    return wrap;
  }

  const status = t.notInTournament
    ? `<span class="st" style="background:#3a2a2a;color:#ffb3b3">NOT IN WC2026</span>`
    : (t.alive ? `<span class="st live-ok">IN</span>` : `<span class="st" style="background:#2a3658;color:#9aa3bd">OUT 💀</span>`);
  const head = el("div", "m-team-head");
  head.innerHTML =
    (t.logo ? `<img src="${esc(t.logo)}" alt="">` : "") +
    `<span class="nm">${esc(t.country)}</span>` + status +
    `<span class="pp">${t.points} pts</span>`;
  wrap.append(head);

  if (t.notInTournament) {
    wrap.append(el("div", "m-note", "Not in the 2026 World Cup field — this pick scores nothing."));
    return wrap;
  }

  const fx = el("div", "m-fixtures");
  const games = teamFixtures(t.country);
  if (!games.length) fx.append(el("div", "fx pre", `<span class="fx-rd">—</span><span class="fx-opp">No fixtures yet</span><span class="fx-res"></span>`));
  games.forEach((g) => fx.append(fixtureRow(g, t.country)));
  wrap.append(fx);
  return wrap;
}
function teamFixtures(country) {
  return DATA.matches
    .filter((m) => resolveCountry(m.home.name) === country || resolveCountry(m.away.name) === country)
    .sort((a, b) => (a.kickoff || "").localeCompare(b.kickoff || ""));
}
function fixtureRow(m, country) {
  const isHome = resolveCountry(m.home.name) === country;
  const me = isHome ? m.home : m.away, opp = isHome ? m.away : m.home;
  const rd = ROUNDS[m.round] ? ROUNDS[m.round].short : "—";
  let cls = "pre", res = m.detail || "Scheduled";
  if (m.state === "in") { cls = "inplay"; res = `${num(me.score)}–${num(opp.score)} ⚡`; }
  else if (m.completed) {
    const a = num(me.score), b = num(opp.score);
    const won = me.winner === true || (a > b);
    const drew = a === b && m.round === "group-stage";
    cls = drew ? "draw" : won ? "win" : "loss";
    res = `${a}–${b} ${drew ? "D" : won ? "W" : "L"}`;
  }
  return el("div", "fx " + cls,
    `<span class="fx-rd">${rd}</span>` +
    `<span class="fx-opp">${isHome ? "" : "<span class='vs'>@ </span>"}${esc(opp.name)}</span>` +
    `<span class="fx-res">${esc(res)}</span>`);
}
function closeModal() { $("#modal").hidden = true; document.body.style.overflow = ""; }
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* ---- Fixtures helpers ----------------------------------------------------- */
function nextFixtures(n) {
  const now = Date.now();
  return DATA.matches
    .filter((m) => !m.completed && m.state !== "post" && resolveCountry(m.home.name) && resolveCountry(m.away.name))
    .filter((m) => !m.kickoff || new Date(m.kickoff).getTime() > now - 3 * 3600e3)
    .sort((a, b) => (a.kickoff || "").localeCompare(b.kickoff || ""))
    .slice(0, n);
}
function kickoffLabel(m) {
  if (!m.kickoff) return ROUNDS[m.round]?.short || "TBD";
  const d = new Date(m.kickoff);
  return d.toLocaleDateString(undefined, { weekday: "short" }) + " " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/* ---- Schedule / upcoming fixtures ---------------------------------------- */
let schedExpanded = false;
const SCHED_LIMIT = 12;

function renderSchedule() {
  const sec = document.querySelector("#schedule");
  sec.innerHTML = "";
  const upcoming = DATA.matches
    .filter((m) => !m.completed && m.state !== "post")
    .sort((a, b) => (a.kickoff || "~").localeCompare(b.kickoff || "~"));

  const head = el("div", "sched-head",
    `<span class="sched-title">📅 Fixtures &amp; kick-off times</span>` +
    `<span class="sched-count">${upcoming.length ? upcoming.length + " to play" : "all done"}</span>`);
  sec.append(head);

  if (!upcoming.length) {
    sec.append(el("div", "sched-empty", "Every match has been played — that's a wrap on World Cup 2026 🏆"));
    return;
  }

  const upd = new Date(DATA.updated);
  const todayKey = dayKey(upd);
  const tomorrowKey = dayKey(new Date(upd.getTime() + 864e5));
  const shown = schedExpanded ? upcoming : upcoming.slice(0, SCHED_LIMIT);

  const list = el("div", "sched-list");
  let lastDay = null;
  shown.forEach((m) => {
    const dk = m.kickoff ? dayKey(new Date(m.kickoff)) : "tbd";
    if (dk !== lastDay) { lastDay = dk; list.append(dayHeader(m.kickoff, todayKey, tomorrowKey)); }
    list.append(fixtureCard(m));
  });
  sec.append(list);

  if (upcoming.length > SCHED_LIMIT) {
    const btn = el("button", "sched-toggle",
      schedExpanded ? "Show fewer" : `Show all ${upcoming.length} fixtures ↓`);
    btn.onclick = () => { schedExpanded = !schedExpanded; renderSchedule(); };
    sec.append(btn);
  }
}

function dayKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

function dayHeader(kickoff, todayKey, tomorrowKey) {
  const h = el("div", "day-head");
  if (!kickoff) { h.innerHTML = `<span class="day-name">Date to be confirmed</span>`; return h; }
  const d = new Date(kickoff);
  const k = dayKey(d);
  const name = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  let tag = "";
  if (k === todayKey) tag = `<span class="day-tag today">Today</span>`;
  else if (k === tomorrowKey) tag = `<span class="day-tag">Tomorrow</span>`;
  h.innerHTML = `<span class="day-name">${name}</span>${tag}`;
  return h;
}

function fixtureCard(m) {
  const live = m.state === "in";
  const card = el("div", "fixture" + (live ? " live" : ""));

  const timeCol = el("div", "fx-time-col");
  if (live) timeCol.innerHTML = `<span class="live-badge"><span class="live-dot"></span>LIVE</span>`;
  else timeCol.innerHTML = `<span class="fx-clock">${kickoffTime(m.kickoff)}</span>`;
  timeCol.append(el("div", "fx-round", ROUNDS[m.round] ? ROUNDS[m.round].short : "—"));

  const teams = el("div", "fx-teams");
  teams.append(sideRow(m.home, live));
  teams.append(sideRow(m.away, live));

  card.append(timeCol, teams);
  return card;
}

function sideRow(side, live) {
  const row = el("div", "fx-side");
  const c = resolveCountry(side.name);
  const owner = c && ownerOf(c);
  const flag = side.logo
    ? `<img class="fx-flag" src="${esc(side.logo)}" alt="" loading="lazy">`
    : c
      ? `<span class="fx-flag mono-flag">${esc((side.abbr || side.name).slice(0, 3))}</span>`
      : `<span class="fx-flag mono-flag tbd">?</span>`; // unresolved bracket placeholder
  const ownerChip = owner ? `<span class="owner-chip">${esc(owner)}</span>` : "";
  const score = live ? `<span class="fx-score">${num(side.score)}</span>` : "";
  row.innerHTML = `${flag}<span class="fx-tname">${esc(side.name)}</span>${ownerChip}${score}`;
  return row;
}

function kickoffTime(kickoff) {
  if (!kickoff) return "TBD";
  return new Date(kickoff).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/* ---- Footer -------------------------------------------------------------- */
function renderFooter() {
  const u = new Date(DATA.updated);
  $("#updated").textContent = "Scores updated " + u.toLocaleString(undefined,
    { weekday: "short", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" }) +
    `  ·  ${DATA.counts.completed}/${DATA.counts.matches} matches played`;
}

/* ---- Confetti (champion) -------------------------------------------------- */
function celebrate() {
  const cv = $("#confetti"); const ctx = cv.getContext("2d");
  cv.width = innerWidth; cv.height = innerHeight;
  const cols = ["#c8ff36", "#ffc94d", "#36e0cf", "#ff3d7f", "#f4f1e6"];
  const N = 140, parts = Array.from({ length: N }, () => ({
    x: Math.random() * cv.width, y: -20 - Math.random() * cv.height,
    r: 4 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0],
    vy: 2 + Math.random() * 3, vx: -1 + Math.random() * 2, a: Math.random() * Math.PI,
  }));
  let t = 0;
  (function frame() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts.forEach((p) => {
      p.y += p.vy; p.x += p.vx; p.a += .1;
      ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - t / 220);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * .6); ctx.restore();
    });
    if (t++ < 220) requestAnimationFrame(frame); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* ---- Adaptive polling / boot ---------------------------------------------- */
// data.json itself only changes when the GitHub Action redeploys, so there's no
// point hammering it. Poll briskly while a match is live, ease off when one is
// imminent, and go quiet otherwise — and stop entirely in a background tab.
const POLL = { live: 45000, soon: 120000, idle: 600000 }; // 45s · 2m · 10m
let pollTimer = null;

function nextDelay() {
  if (!DATA) return POLL.idle;
  if (DATA.matches.some((m) => m.state === "in")) return POLL.live;
  const now = Date.now();
  const imminent = DATA.matches.some((m) => {
    if (m.completed || !m.kickoff) return false;
    const dt = new Date(m.kickoff).getTime() - now;
    return dt < 30 * 60000 && dt > -2 * 3600000; // kicks off within ~30 min
  });
  return imminent ? POLL.soon : POLL.idle;
}

function scheduleNext() {
  clearTimeout(pollTimer);
  if (document.hidden) return;          // background tab: don't poll at all
  pollTimer = setTimeout(tick, nextDelay());
}
async function tick() {
  try { await load(); } catch (e) { console.error(e); }
  scheduleNext();
}

// Returning to the tab: catch up immediately, then resume adaptive polling.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { clearTimeout(pollTimer); return; }
  load().catch(() => {});
  scheduleNext();
});

function num(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; }

/* ---- Tabs: leaderboard / fixtures ---------------------------------------- */
const VIEWS = { leaderboard: "#view-leaderboard", fixtures: "#view-fixtures" };
function setView(v) {
  if (!VIEWS[v]) v = "leaderboard";
  for (const [k, sel] of Object.entries(VIEWS)) document.querySelector(sel).hidden = k !== v;
  document.querySelectorAll(".tab").forEach((b) => {
    const on = b.dataset.view === v;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  try { localStorage.setItem("wc-view", v); } catch {}
}
document.querySelectorAll(".tab").forEach((b) =>
  b.addEventListener("click", () => {
    setView(b.dataset.view);
    document.querySelector(".tabs").scrollIntoView({ block: "start", behavior: "smooth" });
  })
);
(() => { let v = "leaderboard"; try { v = localStorage.getItem("wc-view") || v; } catch {} setView(v); })();

async function refresh() {
  const b = $("#refresh"); b.classList.add("spin");
  try { await load(); } catch (e) { console.error(e); }
  setTimeout(() => b.classList.remove("spin"), 700);
  scheduleNext();
}
$("#refresh").addEventListener("click", refresh);

load()
  .then(scheduleNext)
  .catch((e) => { $("#board").innerHTML = `<div class="loading">Couldn't load scores. ${esc(e.message)}</div>`; });
