import type { Headline, MediaState, Player, PressAnswer, PressQuestion, SaveGame } from "./types";
import { hashSeed, mulberry32 } from "./rng";
import { computeTable } from "./league";
import { overallFor, squadOf } from "./ratings";
import { formOf } from "./stats";
import { pushNews } from "./training";
import { pushInbox } from "./inbox";

export const FANS_START = 55;
export const RESPECT_START = 55;
export const HEADLINES_CAP = 20;

export const emptyMedia = (): MediaState => ({
  fans: FANS_START,
  respect: RESPECT_START,
  headlines: [],
  press: null,
  promises: [],
  pressCount: 0,
  skipped: 0
});

export type FansTone = { label: string; tint: string };
export const fansTone = (fans: number): FansTone =>
  fans >= 80
    ? { label: "Delirious", tint: "#2ED573" }
    : fans >= 65
      ? { label: "Behind you", tint: "#7BE495" }
      : fans >= 45
        ? { label: "Restless", tint: "#8B98A5" }
        : fans >= 30
          ? { label: "Frustrated", tint: "#FFB020" }
          : { label: "Turned", tint: "#FF6B6B" };

export const respectTone = (r: number): FansTone =>
  r >= 70
    ? { label: "Trusted", tint: "#2ED573" }
    : r >= 50
      ? { label: "Respected", tint: "#7BE495" }
      : r >= 35
        ? { label: "Questioned", tint: "#FFB020" }
        : { label: "Under fire", tint: "#FF6B6B" };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const addHeadline = (save: SaveGame, h: Omit<Headline, "season" | "round">, round?: number): void => {
  if (!save.media) return;
  save.media.headlines.unshift({ ...h, season: save.season, round: round ?? save.round });
  if (save.media.headlines.length > HEADLINES_CAP) save.media.headlines.length = HEADLINES_CAP;
};

/** Last N results for the user's club, newest first (W/D/L). */
const recent = (save: SaveGame, n = 5): ("W" | "D" | "L")[] =>
  (save.recentResults ?? []).slice(0, n).map((r) => (r.gf > r.ga ? "W" : r.gf === r.ga ? "D" : "L"));

const bestOf = (save: SaveGame): Player | null => {
  const sq = squadOf(save.players, save.userClubId);
  if (!sq.length) return null;
  return [...sq].sort((a, b) => b.goals - a.goals || overallFor(b) - overallFor(a))[0];
};

const worstOf = (save: SaveGame): Player | null => {
  const sq = squadOf(save.players, save.userClubId);
  if (!sq.length) return null;
  return [...sq].sort((a, b) => (a.morale ?? 60) - (b.morale ?? 60))[0];
};

/**
 * The questions the press actually have, given what is happening at the club.
 * Deterministic: built fresh from the save every time.
 */
export function questionPool(save: SaveGame): PressQuestion[] {
  const club = save.clubs.find((c) => c.id === save.userClubId);
  if (!club) return [];
  const table = computeTable(save.fixtures, save.clubs);
  const mine = table.find((r) => r.clubId === club.id);
  const fx = save.fixtures.find(
    (f) => f.round === save.round && (f.homeId === club.id || f.awayId === club.id)
  );
  const oppId = fx ? (fx.homeId === club.id ? fx.awayId : fx.homeId) : null;
  const opp = oppId ? save.clubs.find((c) => c.id === oppId) : null;
  const oppRow = oppId ? table.find((r) => r.clubId === oppId) : null;
  const form = recent(save, 4);
  const wins = form.filter((r) => r === "W").length;
  const losses = form.filter((r) => r === "L").length;
  const star = bestOf(save);
  const worst = worstOf(save);
  const out = save.players.filter((p) => p.clubId === club.id && p.transferRequest);
  const hurt = save.players
    .filter((p) => p.clubId === club.id && p.injuredWeeks >= 2)
    .sort((a, b) => overallFor(b) - overallFor(a))[0];
  const qs: PressQuestion[] = [];

  if (losses >= 3) {
    qs.push({
      id: "crisis",
      hint: "Three defeats in your last four.",
      text: `It has been a grim few weeks here. What is going wrong at ${club.name}?`,
      answers: [
        {
          label: "The results will come — I have full belief in this group.",
          reply: "You back the players publicly. They will remember that.",
          fans: -2,
          respect: 3,
          morale: 4
        },
        {
          label: "I'm the one responsible. The buck stops with me.",
          reply: "An honest answer. The press respect it; the fans want wins, not words.",
          fans: -3,
          respect: 5,
          morale: 2
        },
        {
          label: "Some of these players aren't good enough. Simple as that.",
          reply: "Ouch. That sentence will be on the back pages — and in the dressing room.",
          fans: 2,
          respect: -4,
          morale: -7,
          target: "worst"
        }
      ]
    });
  } else if (wins >= 3) {
    qs.push({
      id: "flying",
      hint: `${wins} wins in your last ${form.length}.`,
      text: `The mood around ${club.name} is sky high. Are you title contenders now?`,
      answers: [
        {
          label: "We take it one game at a time. Nothing is won in November.",
          reply: "Measured, professional — the sort of answer that ages well.",
          fans: 1,
          respect: 4,
          morale: 1
        },
        {
          label: "We're going to win this league. I believe that completely.",
          reply: "A bold claim. The fans are electrified; the players feel the pressure.",
          fans: 8,
          respect: -2,
          morale: -2,
          promiseWin: true
        },
        {
          label: "Us? We're just happy to be here.",
          reply: "The supporters wince. A club on a run deserves better than that.",
          fans: -5,
          respect: 1,
          morale: -2
        }
      ]
    });
  } else {
    qs.push({
      id: "form",
      hint: "Your recent record: " + (form.length ? form.join(" ") : "no matches yet") + ".",
      text: `How do you assess where ${club.name} are right now?`,
      answers: [
        {
          label: "We're building something. The performances are there.",
          reply: "Steady stuff — the board like the long view.",
          fans: 2,
          respect: 3,
          morale: 2
        },
        {
          label: "We should be higher up this table, and I've told the players that.",
          reply: "A bit of fire. The squad responds to being pushed.",
          fans: 3,
          respect: 1,
          morale: -2
        },
        {
          label: "I'd rather not talk about us — let's talk about the opponent.",
          reply: "The journalists wanted more. Expect a rougher write-up.",
          fans: -1,
          respect: -3,
          morale: 0
        }
      ]
    });
  }

  if (opp && oppRow && mine) {
    const big = oppRow.position <= 2 && mine.position > 3;
    const mustWin = oppRow.position >= 8;
    qs.push({
      id: big ? "bigtest" : mustWin ? "mustwin" : "opponent",
      hint: `Next up: ${opp.name} (${oppRow.position}${oppRow.position === 1 ? "st" : oppRow.position === 2 ? "nd" : oppRow.position === 3 ? "rd" : "th"}).`,
      text: big
        ? `${opp.name} are flying at the top. Are you worried about this one?`
        : mustWin
          ? `${opp.name} are struggling at the bottom. Is this a must-win for you?`
          : `What are you expecting from ${opp.name} this weekend?`,
      answers: [
        {
          label: "We'll match them. I fancy us against anyone at home.",
          reply: "Confident, without being reckless.",
          fans: 3,
          respect: 1,
          morale: 2
        },
        {
          label: "They're a serious side — we'll have to be at our very best.",
          reply: "Respectful. No bulletin-board material for the opposition.",
          fans: 0,
          respect: 3,
          morale: 0
        },
        {
          label: "Three points. That's the only acceptable outcome.",
          reply: "The fans love it. The players hear the expectation loud and clear.",
          fans: 6,
          respect: 0,
          morale: -1,
          promiseWin: true
        }
      ]
    });
  }

  if (star && star.goals >= 3) {
    qs.push({
      id: "talentspot",
      hint: `${star.name} has ${star.goals} goals this season.`,
      text: `${star.name} is in outstanding form. Can you hold on to a player like that?`,
      answers: [
        {
          label: "He's going nowhere. He's central to everything we do.",
          reply: `${star.name} hears you. So does every scout in the division.`,
          fans: 4,
          respect: 2,
          morale: 3,
          target: "star"
        },
        {
          label: "Everyone has a price — but it would take something enormous.",
          reply: "Honest, but the fans don't want to hear it.",
          fans: -4,
          respect: 3,
          morale: -1,
          target: "star"
        },
        {
          label: "The team carries him, not the other way around.",
          reply: `${star.name} will read that. Squad over stars — bold.`,
          fans: 1,
          respect: 1,
          morale: -2,
          target: "star"
        }
      ]
    });
  }

  if (out.length) {
    const p = out[0];
    qs.push({
      id: "unrest",
      hint: `${p.name} has handed in a transfer request.`,
      text: `There are reports that ${p.name} wants out of ${club.name}. Your response?`,
      answers: [
        {
          label: "He's our player, he's under contract, and he'll be treated like everyone else.",
          reply: "A firm line. The board appreciate the clarity.",
          fans: 2,
          respect: 3,
          morale: -3,
          target: "unhappy"
        },
        {
          label: "If he's not committed, he can leave. No one is bigger than the club.",
          reply: "The dressing room goes quiet. Nobody is untouchable.",
          fans: 5,
          respect: 1,
          morale: -6,
          target: "unhappy"
        },
        {
          label: "That's between me and him. I'd rather protect the player.",
          reply: "Loyal. Some of the squad warm to you; the press call it dithering.",
          fans: -2,
          respect: -2,
          morale: 2,
          target: "unhappy"
        }
      ]
    });
  }

  if (hurt) {
    qs.push({
      id: "injury",
      hint: `${hurt.name} is out for ${hurt.injuredWeeks}+ weeks.`,
      text: `Losing ${hurt.name} is a blow. How do you cope without him?`,
      answers: [
        {
          label: "Someone else gets a chance to make that shirt their own.",
          reply: "The bench sits up straighter. Opportunity knocks.",
          fans: 2,
          respect: 3,
          morale: 3
        },
        {
          label: "It's a huge loss. We'll have to find another way.",
          reply: "Honest, if a little bleak for the paying customers.",
          fans: -2,
          respect: 2,
          morale: 1
        },
        {
          label: "No excuses here. The next man up has to be ready.",
          reply: "Standards, plainly stated.",
          fans: 3,
          respect: 2,
          morale: -1
        }
      ]
    });
  }

  if (worst && (worst.morale ?? 60) < 38 && !out.length) {
    qs.push({
      id: "dressing",
      hint: `${worst.name} is deeply unhappy with his minutes.`,
      text: `There are whispers that all is not well in your dressing room.`,
      answers: [
        {
          label: "I speak to my players every day. What happens in there stays in there.",
          reply: "The door closes. The press grumble but move on.",
          fans: 1,
          respect: 2,
          morale: 3,
          target: "worst"
        },
        {
          label: "If anyone's unhappy, they know where my office is.",
          reply: "A challenge, thinly veiled.",
          fans: 3,
          respect: 2,
          morale: -3,
          target: "worst"
        },
        {
          label: "That's rubbish. Whoever told you that is making it up.",
          reply: "Denial. The story runs anyway — and now it has legs.",
          fans: -2,
          respect: -4,
          morale: -1
        }
      ]
    });
  }

  // always at least two candidates
  qs.push({
    id: "default",
    hint: "A quiet week otherwise.",
    text: "The supporters have been loud in their backing. A message for them?",
    answers: [
      {
        label: "They've been magnificent. We do this for them.",
        reply: "A warm line that travels well.",
        fans: 4,
        respect: 2,
        morale: 1
      },
      {
        label: "We need them even louder on matchday. They can be the difference.",
        reply: "A call to arms. The terraces take note.",
        fans: 3,
        respect: 1,
        morale: 2
      },
      {
        label: "Talk is cheap. Judge us on the pitch.",
        reply: "Short and sharp — the reporters wanted a quote.",
        fans: -1,
        respect: -1,
        morale: 1
      }
    ]
  });

  return qs;
}

/** Schedule the press conference for the current round (two questions). */
export function makePress(save: SaveGame): void {
  if (!save.media) return;
  if (save.media.press && save.media.press.round === save.round && save.media.press.season === save.season) return;
  const pool = questionPool(save);
  if (!pool.length) return;
  const rng = mulberry32(hashSeed(save.seed, "press", save.season, save.round));
  const pickIdx: number[] = [];
  while (pickIdx.length < 2 && pickIdx.length < pool.length) {
    const i = Math.floor(rng() * pool.length);
    if (!pickIdx.includes(i)) pickIdx.push(i);
  }
  save.media.press = {
    season: save.season,
    round: save.round,
    questions: pickIdx.map((i) => pool[i]),
    idx: 0,
    log: []
  };
}

export interface PressOutcome {
  reply: string;
  effects: string;
  done: boolean;
}

const label = (n: number, what: string) => (n === 0 ? null : `${n > 0 ? "+" : ""}${n} ${what}`);

/** Apply one answer to the current question. */
export function answerPress(save: SaveGame, answerIndex: number): PressOutcome | { error: string } {
  const m = save.media;
  const press = m?.press;
  if (!m || !press) return { error: "There's no press conference waiting." };
  const q = press.questions[press.idx];
  if (!q) return { error: "That conference is finished." };
  const a: PressAnswer | undefined = q.answers[answerIndex];
  if (!a) return { error: "Pick one of the answers." };

  m.fans = clamp(m.fans + a.fans, 0, 100);
  m.respect = clamp(m.respect + a.respect, 0, 100);
  // squad morale, with a targeted player feeling it hardest
  const sq = squadOf(save.players, save.userClubId);
  let target: Player | null = null;
  if (a.target === "star") target = bestOf(save);
  else if (a.target === "worst") target = worstOf(save);
  else if (a.target === "unhappy") target = save.players.find((p) => p.clubId === save.userClubId && p.transferRequest) ?? null;
  for (const p of sq) {
    const d = p.id === target?.id ? a.morale * 3 : a.morale;
    p.morale = clamp((p.morale ?? 60) + d, 5, 100);
  }
  if (a.promiseWin) {
    m.promises.push({ round: save.round, text: `You promised a win in round ${save.round}` });
  }
  press.log.push({
    q: q.text,
    a: a.label,
    effects: [label(a.fans, "fans"), label(a.respect, "press"), label(a.morale, "morale")].filter(Boolean).join(" · ") || "no real effect"
  });
  press.idx += 1;
  const done = press.idx >= press.questions.length;
  if (done) {
    m.press = null;
    m.pressCount += 1;
    addHeadline(save, {
      kind: "press",
      tone: a.fans + a.respect >= 0 ? "good" : "bad",
      text: `Your press conference leads the back pages — "${a.label}"`
    });
  }
  return {
    reply: a.reply,
    effects: press.log[press.log.length - 1].effects,
    done
  };
}

/** Send the assistant instead: no message, no damage — but the press notice. */
export function skipPress(save: SaveGame): void {
  const m = save.media;
  if (!m?.press) return;
  m.respect = clamp(m.respect - 3, 0, 100);
  m.fans = clamp(m.fans - 1, 0, 100);
  m.skipped += 1;
  m.press = null;
  pushNews(save, "You sent your assistant to face the press. They noticed.");
}

/**
 * Round bookkeeping: fan mood swings with results, promises come due, headlines
 * get written, and the next press conference is scheduled. Runs at the end of
 * `completeRound` (after the round has advanced).
 */
export function mediaTick(save: SaveGame, lastResults: { homeId: string; awayId: string; homeGoals: number; awayGoals: number; scorers: { name: string; minute: number }[]; round: number }[]): void {
  const m = save.media;
  if (!m) return;
  const clubId = save.userClubId;
  const club = save.clubs.find((c) => c.id === clubId);
  const res = lastResults.find((r) => r.homeId === clubId || r.awayId === clubId);

  if (res && club) {
    const home = res.homeId === clubId;
    const gf = home ? res.homeGoals : res.awayGoals;
    const ga = home ? res.awayGoals : res.homeGoals;
    const opp = save.clubs.find((c) => c.id === (home ? res.awayId : res.homeId));
    const played = res.round;
    let fans = gf > ga ? 4 : gf === ga ? 0 : -4;
    if (gf - ga >= 3) fans += 2;
    if (ga - gf >= 3) fans -= 2;
    m.fans = clamp(m.fans + fans, 0, 100);

    const summary = res.scorers.length
      ? res.scorers.map((s) => `${s.name} ${s.minute}'`).join(", ")
      : "a goalless afternoon";
    const tone: Headline["tone"] = gf > ga ? "good" : gf === ga ? "neutral" : "bad";
    addHeadline(
      save,
      {
        kind: "report",
        tone,
        text: `${club.name} ${gf}-${ga} ${opp?.short ?? "?"} — ${summary}`
      },
      played
    );
    if (gf - ga >= 3) {
      addHeadline(
        save,
        { kind: "fan", tone: "good", text: `"Best performance in years" — supporters rave after the ${gf}-${ga} demolition` },
        played
      );
    } else if (ga - gf >= 3) {
      addHeadline(
        save,
        { kind: "fan", tone: "bad", text: `Supporters stream out early as ${club.name} are dismantled ${gf}-${ga}` },
        played
      );
    }

    // promises come due
    const due = m.promises.filter((p) => p.round === res.round);
    if (due.length) {
      m.promises = m.promises.filter((p) => p.round !== res.round);
      const kept = gf > ga;
      if (kept) {
        m.fans = clamp(m.fans + 6, 0, 100);
        m.respect = clamp(m.respect + 2, 0, 100);
        for (const p of squadOf(save.players, clubId)) p.morale = clamp((p.morale ?? 60) + 4, 5, 100);
        addHeadline(save, { kind: "promise", tone: "good", text: "A promise kept: you called the win and the players delivered" }, played);
      } else {
        m.fans = clamp(m.fans - 8, 0, 100);
        m.respect = clamp(m.respect - 3, 0, 100);
        for (const p of squadOf(save.players, clubId)) p.morale = clamp((p.morale ?? 60) - 5, 5, 100);
        addHeadline(save, { kind: "promise", tone: "bad", text: "Back-page backlash: you promised a win and it did not arrive" }, played);
      }
    }
  }

  // fan mood headline bands
  if (m.fans >= 80) addHeadline(save, { kind: "fan", tone: "good", text: "The Gazette: 'This club is alive again' — fan confidence at a season high" });
  else if (m.fans <= 25) addHeadline(save, { kind: "fan", tone: "bad", text: "Supporter groups demand answers after another grim week" });

  // the odd rumour
  const rng = mulberry32(hashSeed(save.seed, "media", save.season, save.round));
  if (rng() < 0.3) {
    const sq = squadOf(save.players, clubId);
    const out = sq.filter((p) => p.transferRequest);
    const star = [...sq].sort((a, b) => b.goals - a.goals)[0];
    const subject = out[0] ?? star;
    if (subject) {
      addHeadline(save, {
        kind: "rumour",
        tone: out.length ? "bad" : "neutral",
        text: out.length
          ? `Transfer talk: ${subject.name} is "certain" to leave, say sources close to the club`
          : `Rivals are monitoring ${subject.name} after his run of form`
      });
    }
  }

  // schedule the next conference
  makePress(save);
}

/** Gate receipts at the rollover: a happy crowd pays. */
export function mediaGate(save: SaveGame): void {
  const m = save.media;
  const fin = save.finances?.[save.userClubId];
  if (!m || !fin) return;
  const delta = Math.round(clamp((m.fans - 50) * 40_000, -2_000_000, 2_000_000));
  fin.transfer += delta;
  if (delta !== 0) {
    pushNews(
      save,
      delta > 0
        ? `Gate receipts: a buoyant crowd added ${(delta / 1_000_000).toFixed(1)}m to the transfer kitty.`
        : `Gate receipts: flat attendances cost the club ${(Math.abs(delta) / 1_000_000).toFixed(1)}m.`
    );
  }
}

/** Fan mood in the dressing room: a roaring crowd lifts players, a toxic one drags. */
export function fanMoraleFactor(fans: number | undefined): { label: string; val: number } | null {
  if (fans === undefined) return null;
  if (fans >= 70) return { label: "The crowd is right behind us", val: 0.6 };
  if (fans <= 32) return { label: "The crowd has turned", val: -0.7 };
  return null;
}
