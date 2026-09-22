import { create } from "zustand";
import type {
  TraitId,
  Position,
  FormationDef,
  Lineup,
  MatchResult,
  Mentality,
  Player,
  RoleId,
  SaveGame
} from "@/engine";
import {
  acceptOffer,
  addLiveChange,
  autoLineup,
  bidForPlayer,
  builtinFormation,
  changeMinute,
  completeRound,
  finalizeLive,
  fixLineup,
  isAvailable,
  newGame,
  nextSeason,
  offerTerms,
  playersById,
  prepareRound,
  rejectOffer,
  remapLineup,
  renewContract,
  resolveFormation,
  resumeSecondHalf,
  ROLE_GROUPS,
  seasonRounds,
  signFreeAgent,
  skipToFullTime,
  skipToHalfTime,
  slotScoreFor,
  squadOf,
  startLive,
  T, playRound } from "@/engine";
import type { BidResponse } from "@/engine";
import type { AttrKey, CornerRoutine, FreeKickRoutine, TrainingPlan } from "@/engine";
import { cleanSetPieces } from "@/engine";
import {
  applyTeamTalk,
  addFocus as addFocusEngine,
  askAgent as askAgentEngine,
  markAllInboxRead,
  openInboxItem as openInboxItemEngine,
  applyDiscipline,
  cancelMove as cancelMoveEngine,
  cancelRetrain as cancelRetrainEngine,
  clearTarget as clearTargetEngine,
  setArmband as setArmbandEngine,
  setTarget as setTargetEngine,
  startMove as startMoveEngine,
  startRetrain as startRetrainEngine,
  bidForLoan,
  cancelPreContract as cancelPreContractEngine,
  exerciseLoanOption,
  offerPreContract,
  reallocate as reallocateEngine,
  setListed as setListedEngine,
  triggerExtension as triggerExtensionEngine,
  answerPress as answerPressEngine,
  cancelRequest as cancelRequestEngine,
  dismissScout as dismissScoutEngine,
  hireScout as hireScoutEngine,
  scoutPlayer as scoutPlayerEngine,
  skipPress as skipPressEngine,
  talkToPlayer as talkToPlayerEngine,
  toggleShortlist as toggleShortlistEngine,
  topUpScouting as topUpScoutingEngine,
  leaders as leadersOf
} from "@/engine";
import type {
  AgentInterest,
  ContractTerms,
  DealTerms,
  OppInstruction,
  PlayerInstruction,
  PressOutcome,
  ShoutKind,
  TalkKind,
  TalkStage
} from "@/engine";
import { autosave, deleteSlot, listSlots, loadSave, loadSlot, persistSave, saveToSlot, type SlotMeta } from "./save";

export type Screen =
  | "new"
  | "home"
  | "squad"
  | "tactics"
  | "league"
  | "transfers"
  | "training"
  | "setpieces"
  | "match"
  | "inbox"
  | "help"
  | "seasonEnd"
  | "builder";
export type SlotRef = { kind: "xi" | "bench"; index: number };

interface AppState {
  loaded: boolean;
  /** save slots (v0.26): 0 = autosave, 1..3 = manual */
  slots: SlotMeta[];
  game: SaveGame | null;
  screen: Screen;
  reveal: MatchResult | null;
  builderFor: string | null; // custom formation id being edited (null = creating)

  init: () => Promise<void>;
  startNewGame: (clubId: string) => void;
  advance: () => void;
  finishMatch: () => void;
  liveSub: (outId: string, inId: string) => string | null;
  liveMentality: (m: Mentality) => void;
  liveRole: (slot: number, role: RoleId) => void;
  /** opposition instruction on one of their players (empty object = clear) */
  setOi: (targetId: string, oi: OppInstruction) => string | null;
  /** instruction for one of your own players */
  setPi: (playerId: string, pi: PlayerInstruction) => string | null;
  /** team talk: moves the dressing room, and the match */
  teamTalk: (stage: TalkStage, kind: TalkKind) => string | null;
  /** a touchline shout */
  shout: (kind: ShoutKind) => void;
  startSecondHalf: () => void;
  skipTo: (to: "ht" | "ft") => void;
  setPlayhead: (m: number) => void;
  startNextSeason: () => void;
  setScreen: (s: Screen) => void;
  setFormation: (f: string) => void;
  setMentality: (m: Mentality) => void;
  setRole: (index: number, role: RoleId) => void;
  assignPlayer: (kind: "xi" | "bench", index: number, playerId: string) => void;
  clearSlot: (kind: "xi" | "bench", index: number) => void;
  swapSlots: (a: SlotRef, b: SlotRef) => void;
  autoPick: (mode?: "best" | "freshest") => number;
  applySuggestions: () => number;
  setBuilderFor: (id: string | null) => void;
  saveCustomFormation: (def: FormationDef) => void;
  deleteCustomFormation: (id: string) => void;
  bidFor: (playerId: string, terms: number | DealTerms) => BidResponse | null;
  signTerms: (playerId: string, terms: number | ContractTerms) => BidResponse | null;
  renew: (playerId: string, terms: number | ContractTerms) => BidResponse | null;
  signFree: (playerId: string, terms: number | ContractTerms) => BidResponse | null;
  acceptIncoming: (offerId: string) => BidResponse | null;
  rejectIncoming: (offerId: string) => void;
  cancelDeal: () => void;
  /** borrow a player for the season */
  loanIn: (playerId: string, offer: { wageShare: number; fee: number; optionFee?: number; obligation?: boolean }) => BidResponse | null;
  /** make a loanee permanent */
  loanOption: (playerId: string) => string | null;
  /** put a player on the market (or take him off it) */
  setListed: (playerId: string, listed: boolean) => void;
  /** what his agent reckons the market looks like */
  askAgent: (playerId: string) => AgentInterest;
  /** a free transfer agreed for the end of the season */
  preContract: (playerId: string, wage: number, years: number) => string | null;
  cancelPreContract: (playerId: string) => void;
  /** take up a club option in a contract */
  triggerExtension: (playerId: string) => string | null;
  /** individual development & discipline (v0.25) */
  setTarget: (playerId: string, kind: "goals" | "apps" | "rating", value: number) => string | null;
  clearTarget: (playerId: string) => void;
  startRetrain: (playerId: string, pos: Position) => string | null;
  cancelRetrain: (playerId: string) => void;
  startMove: (playerId: string, trait: TraitId) => string | null;
  cancelMove: (playerId: string) => void;
  finePlayer: (playerId: string, kind: "fine" | "warn" | "none") => string | null;
  setArmband: (playerId: string, role: "captain" | "vice" | "none") => string | null;
  /** move money between the transfer budget and the wage ceiling */
  reallocate: (direction: "toWage" | "toTransfer", weekly: number) => string;
  setTraining: (patch: Partial<TrainingPlan>) => void;
  setFocus: (playerId: string, focus: AttrKey | null) => void;
  setRoutine: (kind: "corner" | "freekick", routine: string) => void;
  setTaker: (kind: "corner" | "freekick" | "penalty", playerId: string | null) => void;
  scoutPlayer: (playerId: string) => string | null;
  addFocus: (filter: { pos: Position | "any"; maxAge: number; minPotStars: number }) => string | null;
  cancelRequest: (id: string) => void;
  hireScout: (id: string) => string | null;
  dismissScout: (id: string) => void;
  toggleShortlist: (playerId: string) => void;
  topUpScouting: (amount: number) => string | null;
  /** praise or warn a player; returns an error string or the reaction */
  talk: (playerId: string, kind: "praise" | "warn") => string | { message: string; delta: number };
  /** answer the current press question; returns the outcome or an error */
  answerPress: (index: number) => PressOutcome | { error: string };
  /** send the assistant to the press conference */
  skipPress: () => void;
  resetGame: () => void;
  /** sim the remaining pre-season friendlies instantly */
  skipPreseason: () => void;
  /** open an inbox item: marks it read and returns the screen to show */
  openInboxItem: (id: string) => string | undefined;
  markInboxAllRead: () => void;
  refreshSlots: () => Promise<void>;
  saveToSlotNow: (n: number, name?: string) => Promise<string>;
  loadSlotNow: (n: number) => Promise<string>;
  deleteSlotNow: (n: number) => Promise<void>;
  importSave: (save: SaveGame) => void;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
let lastPlayheadPersist = 0;
let lastAutoKey = "";
const schedulePersist = (game: SaveGame | null) => {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void persistSave(game);
    // a fresh autosave whenever the season or round moves on
    if (game) {
      const key = `${game.season}:${game.round}`;
      if (key !== lastAutoKey) {
        lastAutoKey = key;
        void autosave(game);
      }
    }
  }, 400);
};

const defFor = (game: SaveGame, id: string): FormationDef =>
  resolveFormation(id, game.customFormations) ?? builtinFormation("4-3-3");

/** The match is finished once the playback has reached the end of the second half. */
const matchOver = (live: NonNullable<SaveGame["live"]>): boolean =>
  live.half === 2 && live.playhead >= live.state.total;

export const useGame = create<AppState>()((set, get) => ({
  loaded: false,
  slots: [],
  game: null,
  screen: "new",
  reveal: null,
  builderFor: null,

  init: async () => {
    const save = await loadSave();
    set({ game: save, loaded: true, screen: save ? (save.live ? "match" : "home") : "new" });
  },

  startNewGame: (clubId) => {
    const seed = Math.floor(Math.random() * 1_000_000) + 1;
    const game = newGame(seed, clubId);
    set({ game, screen: "home", reveal: null, builderFor: null });
    schedulePersist(game);
  },

  /** Play out the rest of pre-season in one go. */
  skipPreseason: () => {
    const { game } = get();
    if (!game) return;
    let save = game;
    let guard = 0;
    while (save.round < 0 && guard++ < 8) save = playRound(save).save;
    set({ game: save, reveal: null, screen: "home" });
    schedulePersist(save);
  },

  advance: () => {
    const { game } = get();
    if (!game) return;
    if (game.live) {
      set({ screen: "match" });
      return;
    }
    if (game.round > seasonRounds(game)) {
      set({ screen: "seasonEnd" });
      return;
    }
    const prepared = prepareRound(game);
    const live = startLive(prepared);
    if (!live) {
      const save = completeRound(prepared, undefined);
      set({ game: save, reveal: null, screen: "home" });
      schedulePersist(save);
      return;
    }
    const save = { ...prepared, live };
    set({ game: save, reveal: null, screen: "match" });
    schedulePersist(save);
  },

  finishMatch: () => {
    const { game } = get();
    if (!game) return;
    if (game.live) {
      const result = finalizeLive(game.live);
      const save = completeRound({ ...game, live: undefined }, result);
      set({
        game: save,
        reveal: result,
        screen: save.round > seasonRounds(save) ? "seasonEnd" : "home"
      });
      schedulePersist(save);
      return;
    }
    set({
      reveal: null,
      screen: game.round > seasonRounds(game) ? "seasonEnd" : "home"
    });
  },

  liveSub: (outId, inId) => {
    const { game } = get();
    if (!game?.live) return "No live match.";
    if (matchOver(game.live)) return "The match is over.";
    const side = game.live.state.userSide ?? "home";
    const players = playersById(game);
    const minute = changeMinute(game.live);
    const res = addLiveChange(game.live, players, { minute, kind: "sub", side, outId, inId });
    if (res.error) return res.error;
    const save = { ...game, live: res.live! };
    set({ game: save });
    schedulePersist(save);
    return null;
  },

  liveMentality: (m) => {
    const { game } = get();
    if (!game?.live) return;
    if (matchOver(game.live)) return;
    const side = game.live.state.userSide ?? "home";
    const minute = changeMinute(game.live);
    const players = playersById(game);
    const res = addLiveChange(game.live, players, { minute, kind: "mentality", side, mentality: m });
    if (res.error) return;
    const lineup = { ...game.lineup, mentality: m };
    const save = { ...game, lineup, live: res.live! };
    set({ game: save });
    schedulePersist(save);
  },

  liveRole: (slot, role) => {
    const { game } = get();
    if (!game?.live) return;
    if (matchOver(game.live)) return;
    const side = game.live.state.userSide ?? "home";
    const minute = changeMinute(game.live);
    const players = playersById(game);
    const res = addLiveChange(game.live, players, { minute, kind: "role", side, slot, role });
    if (res.error) return;
    const roles = [...game.lineup.roles];
    if (side === "home" || side === "away") roles[slot] = role;
    const save = { ...game, lineup: { ...game.lineup, roles }, live: res.live! };
    set({ game: save });
    schedulePersist(save);
  },

  setOi: (targetId, oi) => {
    const { game } = get();
    if (!game?.live) return "No live match.";
    if (matchOver(game.live)) return "The match is over.";
    const side = game.live.state.userSide ?? "home";
    const minute = changeMinute(game.live);
    const res = addLiveChange(game.live, playersById(game), { minute, kind: "oi", side, targetId, oi });
    if (res.error) return res.error;
    const save = { ...game, live: res.live! };
    set({ game: save });
    schedulePersist(save);
    return null;
  },

  setPi: (playerId, pi) => {
    const { game } = get();
    if (!game?.live) return "No live match.";
    if (matchOver(game.live)) return "The match is over.";
    const side = game.live.state.userSide ?? "home";
    const minute = changeMinute(game.live);
    const res = addLiveChange(game.live, playersById(game), { minute, kind: "pi", side, targetId: playerId, pi });
    if (res.error) return res.error;
    const save = { ...game, live: res.live! };
    set({ game: save });
    schedulePersist(save);
    return null;
  },

  teamTalk: (stage, kind) => {
    const { game } = get();
    if (!game?.live) return "No live match.";
    if (matchOver(game.live)) return "The match is over.";
    const side = game.live.state.userSide ?? "home";
    const st = game.live.state;
    if (st[side].talks[stage]) return "You have already had your say.";
    const minute = changeMinute(game.live);
    const players = playersById(game);
    const res = addLiveChange(game.live, players, { minute, kind: "talk", side, stage, talk: kind });
    if (res.error) return res.error;
    // the words land in the dressing room too: morale moves for good
    const opp = side === "home" ? st.away : st.home;
    const gf = side === "home" ? st.home.goals : st.away.goals;
    const ga = side === "home" ? st.away.goals : st.home.goals;
    void opp;
    const leaders = new Set(leadersOf(game, game.userClubId).map((p) => p.id));
    const talked = applyTeamTalk(game, stage, kind, gf, ga, leaders);
    const save = { ...game, players: talked.players, live: res.live! };
    set({ game: save });
    schedulePersist(save);
    return null;
  },

  shout: (kind) => {
    const { game } = get();
    if (!game?.live) return;
    if (matchOver(game.live)) return;
    const side = game.live.state.userSide ?? "home";
    const minute = changeMinute(game.live);
    const res = addLiveChange(game.live, playersById(game), { minute, kind: "shout", side, shout: kind });
    if (res.error) return;
    const save = { ...game, live: res.live! };
    set({ game: save });
    schedulePersist(save);
  },

  startSecondHalf: () => {
    const { game } = get();
    if (!game?.live || game.live.half !== 1) return;
    const players = playersById(game);
    const live = resumeSecondHalf(game.live, players);
    const save = { ...game, live };
    set({ game: save });
    schedulePersist(save);
  },

  skipTo: (to) => {
    const { game } = get();
    if (!game?.live) return;
    const players = playersById(game);
    const live =
      to === "ht"
        ? game.live.half === 1
          ? skipToHalfTime(game.live)
          : game.live
        : skipToFullTime(game.live, players);
    const save = { ...game, live };
    set({ game: save });
    schedulePersist(save);
  },

  setPlayhead: (m) => {
    const { game } = get();
    if (!game?.live) return;
    set({ game: { ...game, live: { ...game.live, playhead: m } } });
    const now = Date.now();
    if (now - lastPlayheadPersist > 10000) {
      lastPlayheadPersist = now;
      schedulePersist(get().game);
    }
  },

  startNextSeason: () => {
    const { game } = get();
    if (!game) return;
    const save = nextSeason(game);
    set({ game: save, screen: "home", reveal: null });
    schedulePersist(save);
  },

  setScreen: (screen) => set({ screen }),

  setFormation: (formation) => {
    const { game } = get();
    if (!game || formation === game.lineup.formation) return;
    const to = resolveFormation(formation, game.customFormations);
    if (!to) return;
    const from = defFor(game, game.lineup.formation);
    const lineup = remapLineup(squadOf(game.players, game.userClubId), game.lineup, from, to);
    const save = { ...game, lineup };
    set({ game: save });
    schedulePersist(save);
  },

  setMentality: (mentality) => {
    const { game } = get();
    if (!game) return;
    const save = { ...game, lineup: { ...game.lineup, mentality } };
    set({ game: save });
    schedulePersist(save);
  },

  setRole: (index, role) => {
    const { game } = get();
    if (!game) return;
    const slotPos = defFor(game, game.lineup.formation).slots[index]?.pos;
    if (!slotPos || !ROLE_GROUPS[slotPos].includes(role)) return;
    const lineup: Lineup = structuredClone(game.lineup);
    lineup.roles[index] = role;
    const save = { ...game, lineup };
    set({ game: save });
    schedulePersist(save);
  },

  assignPlayer: (kind, index, playerId) => {
    const { game } = get();
    if (!game) return;
    const lineup: Lineup = structuredClone(game.lineup);
    const arr = (k: "xi" | "bench") => (k === "xi" ? lineup.starters : lineup.bench);
    const target = arr(kind);
    const occupant = target[index] ?? null;

    let from: { kind: "xi" | "bench"; index: number } | null = null;
    if (lineup.starters.includes(playerId)) {
      from = { kind: "xi", index: lineup.starters.indexOf(playerId) };
    } else if (lineup.bench.includes(playerId)) {
      from = { kind: "bench", index: lineup.bench.indexOf(playerId) };
    }

    if (from && from.kind === kind && from.index === index) return;

    if (from) {
      arr(from.kind)[from.index] = occupant;
    } else if (occupant && kind === "xi") {
      // displaced starter drops to the bench if there is room
      const empty = lineup.bench.indexOf(null);
      if (empty >= 0) lineup.bench[empty] = occupant;
    }
    target[index] = playerId;

    const save = { ...game, lineup };
    set({ game: save });
    schedulePersist(save);
  },

  clearSlot: (kind, index) => {
    const { game } = get();
    if (!game) return;
    const lineup: Lineup = structuredClone(game.lineup);
    (kind === "xi" ? lineup.starters : lineup.bench)[index] = null;
    const save = { ...game, lineup };
    set({ game: save });
    schedulePersist(save);
  },

  swapSlots: (a, b) => {
    const { game } = get();
    if (!game) return;
    if (a.kind === b.kind && a.index === b.index) return;
    const lineup: Lineup = structuredClone(game.lineup);
    const arr = (k: "xi" | "bench") => (k === "xi" ? lineup.starters : lineup.bench);
    const av = arr(a.kind)[a.index] ?? null;
    arr(a.kind)[a.index] = arr(b.kind)[b.index] ?? null;
    arr(b.kind)[b.index] = av;
    const save = { ...game, lineup };
    set({ game: save });
    schedulePersist(save);
  },

  autoPick: (mode = "best") => {
    const { game } = get();
    if (!game) return 0;
    const lineup = autoLineup(
      squadOf(game.players, game.userClubId),
      defFor(game, game.lineup.formation),
      {
        freshest: mode === "freshest",
        mentality: game.lineup.mentality
      }
    );
    let changes = 0;
    lineup.starters.forEach((id, i) => {
      if (id !== game.lineup.starters[i]) changes++;
    });
    const save = { ...game, lineup };
    set({ game: save });
    schedulePersist(save);
    return changes;
  },

  applySuggestions: () => {
    const { game } = get();
    if (!game) return 0;
    const squad = squadOf(game.players, game.userClubId);
    const byId = new Map(squad.map((p) => [p.id, p] as const));
    const def = defFor(game, game.lineup.formation);
    const lineup = fixLineup(squad, structuredClone(game.lineup), def);
    const slots = def.slots;
    let changes = 0;

    for (let i = 0; i < lineup.starters.length; i++) {
      const id = lineup.starters[i];
      const cur = id ? byId.get(id) : undefined;
      const needs = !cur || !isAvailable(cur) || cur.condition < T.tiredThreshold;
      if (!needs) continue;
      const alt = lineup.bench
        .map((bid) => (bid ? byId.get(bid) : undefined))
        .filter((p): p is Player => !!p && isAvailable(p))
        .sort(
          (a, b) =>
            slotScoreFor(b, slots[i].pos, lineup.roles[i], 0.45) -
            slotScoreFor(a, slots[i].pos, lineup.roles[i], 0.45)
        )[0];
      if (!alt) continue;
      // tired but fit: only swap for a meaningfully fresher option
      if (cur && isAvailable(cur) && alt.condition <= cur.condition + 10) continue;
      const benchIdx = lineup.bench.indexOf(alt.id);
      if (benchIdx < 0) continue;
      lineup.bench[benchIdx] = cur ? cur.id : null;
      lineup.starters[i] = alt.id;
      changes++;
    }

    if (changes > 0) {
      const save = { ...game, lineup };
      set({ game: save });
      schedulePersist(save);
    }
    return changes;
  },

  setBuilderFor: (id) => set({ builderFor: id }),

  saveCustomFormation: (def) => {
    const { game } = get();
    if (!game) return;
    const customs = [...game.customFormations.filter((f) => f.id !== def.id), def];
    const from = defFor(game, game.lineup.formation);
    const lineup = remapLineup(squadOf(game.players, game.userClubId), game.lineup, from, def);
    const save = { ...game, customFormations: customs, lineup };
    set({ game: save, screen: "tactics", builderFor: null });
    schedulePersist(save);
  },

  deleteCustomFormation: (id) => {
    const { game } = get();
    if (!game) return;
    const customs = game.customFormations.filter((f) => f.id !== id);
    let save: SaveGame = { ...game, customFormations: customs };
    if (game.lineup.formation === id) {
      const from = defFor(game, id);
      save = {
        ...save,
        lineup: remapLineup(
          squadOf(game.players, game.userClubId),
          game.lineup,
          from,
          builtinFormation("4-3-3")
        )
      };
    }
    set({ game: save });
    schedulePersist(save);
  },

  bidFor: (playerId, terms) => {
    const { game } = get();
    if (!game) return null;
    const r = bidForPlayer(game, playerId, terms);
    set({ game: r.save });
    schedulePersist(r.save);
    return r.resp;
  },

  signTerms: (playerId, terms) => {
    const { game } = get();
    if (!game) return null;
    const r = offerTerms(game, playerId, terms);
    set({ game: r.save });
    schedulePersist(r.save);
    return r.resp;
  },

  renew: (playerId, terms) => {
    const { game } = get();
    if (!game) return null;
    const r = renewContract(game, playerId, terms);
    set({ game: r.save });
    schedulePersist(r.save);
    return r.resp;
  },

  signFree: (playerId, terms) => {
    const { game } = get();
    if (!game) return null;
    const r = signFreeAgent(game, playerId, terms);
    set({ game: r.save });
    schedulePersist(r.save);
    return r.resp;
  },

  acceptIncoming: (offerId) => {
    const { game } = get();
    if (!game) return null;
    const r = acceptOffer(game, offerId);
    set({ game: r.save });
    schedulePersist(r.save);
    return r.resp;
  },

  rejectIncoming: (offerId) => {
    const { game } = get();
    if (!game) return;
    const save = rejectOffer(game, offerId);
    set({ game: save });
    schedulePersist(save);
  },

  cancelDeal: () => {
    const { game } = get();
    if (!game || !game.pending) return;
    const save: SaveGame = { ...game, pending: undefined };
    set({ game: save });
    schedulePersist(save);
  },

  loanIn: (playerId, offer) => {
    const { game } = get();
    if (!game) return null;
    const r = bidForLoan(game, playerId, offer);
    set({ game: r.save });
    schedulePersist(r.save);
    return { kind: r.resp.kind, message: r.resp.message, ...(r.resp.fee ? { fee: r.resp.fee } : {}) } as BidResponse;
  },

  loanOption: (playerId) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const r = exerciseLoanOption(game, playerId);
    if (!r.resp.ok) return r.resp.message;
    set({ game: r.save });
    schedulePersist(r.save);
    return null;
  },

  setListed: (playerId, listed) => {
    const { game } = get();
    if (!game) return;
    const save = setListedEngine(game, playerId, listed);
    set({ game: save });
    schedulePersist(save);
  },

  askAgent: (playerId) => {
    const { game } = get();
    return game ? askAgentEngine(game, playerId) : { level: "none" as const, clubs: 0, line: "No game loaded." };
  },

  preContract: (playerId, wage, years) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const r = offerPreContract(game, playerId, wage, years);
    if (!r.resp.ok) return r.resp.message;
    set({ game: r.save });
    schedulePersist(r.save);
    return null;
  },

  cancelPreContract: (playerId) => {
    const { game } = get();
    if (!game) return;
    const save = cancelPreContractEngine(game, playerId);
    set({ game: save });
    schedulePersist(save);
  },

  triggerExtension: (playerId) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const r = triggerExtensionEngine(game, playerId);
    if (!r.resp.ok) return r.resp.message;
    set({ game: r.save });
    schedulePersist(r.save);
    return null;
  },

  setTarget: (playerId, kind, value) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const r = setTargetEngine(game, playerId, kind, value);
    if (!r.resp.ok) return r.resp.message;
    set({ game: r.save });
    schedulePersist(r.save);
    return null;
  },

  clearTarget: (playerId) => {
    const { game } = get();
    if (!game) return;
    const save = clearTargetEngine(game, playerId);
    set({ game: save });
    schedulePersist(save);
  },

  startRetrain: (playerId, pos) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const r = startRetrainEngine(game, playerId, pos);
    if (!r.resp.ok) return r.resp.message;
    set({ game: r.save });
    schedulePersist(r.save);
    return null;
  },

  cancelRetrain: (playerId) => {
    const { game } = get();
    if (!game) return;
    const save = cancelRetrainEngine(game, playerId);
    set({ game: save });
    schedulePersist(save);
  },

  startMove: (playerId, trait) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const r = startMoveEngine(game, playerId, trait);
    if (!r.resp.ok) return r.resp.message;
    set({ game: r.save });
    schedulePersist(r.save);
    return null;
  },

  cancelMove: (playerId) => {
    const { game } = get();
    if (!game) return;
    const save = cancelMoveEngine(game, playerId);
    set({ game: save });
    schedulePersist(save);
  },

  finePlayer: (playerId, kind) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const r = applyDiscipline(game, playerId, kind);
    if (!r.resp.ok) return r.resp.message;
    set({ game: r.save });
    schedulePersist(r.save);
    return r.resp.message;
  },

  setArmband: (playerId, role) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const r = setArmbandEngine(game, playerId, role);
    if (!r.resp.ok) return r.resp.message;
    set({ game: r.save });
    schedulePersist(r.save);
    return r.resp.message;
  },

  reallocate: (direction, weekly) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const r = reallocateEngine(game, direction, weekly);
    if (r.resp.ok) {
      set({ game: r.save });
      schedulePersist(r.save);
    }
    return r.resp.message;
  },

  setTraining: (patch) => {
    const { game } = get();
    if (!game) return;
    const save: SaveGame = { ...game, training: { ...game.training, ...patch } };
    set({ game: save });
    schedulePersist(save);
  },

  setFocus: (playerId, focus) => {
    const { game } = get();
    if (!game) return;
    const save: SaveGame = {
      ...game,
      players: game.players.map((p) => (p.id === playerId ? { ...p, focus } : p))
    };
    set({ game: save });
    schedulePersist(save);
  },

  setRoutine: (kind, routine) => {
    const { game } = get();
    if (!game) return;
    const plan = structuredClone(game.setpieces);
    if (kind === "corner") plan.corner = routine as CornerRoutine;
    else plan.freekick = routine as FreeKickRoutine;
    const save: SaveGame = {
      ...game,
      setpieces: cleanSetPieces(plan, new Set(game.players.map((p) => p.id)))
    };
    set({ game: save });
    schedulePersist(save);
  },

  setTaker: (kind, playerId) => {
    const { game } = get();
    if (!game) return;
    const plan = structuredClone(game.setpieces);
    plan.takers[kind] = playerId;
    const save: SaveGame = {
      ...game,
      setpieces: cleanSetPieces(plan, new Set(game.players.map((p) => p.id)))
    };
    set({ game: save });
    schedulePersist(save);
  },

  scoutPlayer: (playerId) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const save = structuredClone(game);
    const err = scoutPlayerEngine(save, playerId);
    if (err) return err;
    set({ game: save });
    schedulePersist(save);
    return null;
  },

  addFocus: (filter) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const save = structuredClone(game);
    const err = addFocusEngine(save, filter);
    if (err) return err;
    set({ game: save });
    schedulePersist(save);
    return null;
  },

  cancelRequest: (id) => {
    const { game } = get();
    if (!game) return;
    const save = structuredClone(game);
    cancelRequestEngine(save, id);
    set({ game: save });
    schedulePersist(save);
  },

  hireScout: (id) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const save = structuredClone(game);
    const err = hireScoutEngine(save, id);
    if (err) return err;
    set({ game: save });
    schedulePersist(save);
    return null;
  },

  dismissScout: (id) => {
    const { game } = get();
    if (!game) return;
    const save = structuredClone(game);
    dismissScoutEngine(save, id);
    set({ game: save });
    schedulePersist(save);
  },

  toggleShortlist: (playerId) => {
    const { game } = get();
    if (!game) return;
    const save = structuredClone(game);
    toggleShortlistEngine(save, playerId);
    set({ game: save });
    schedulePersist(save);
  },

  topUpScouting: (amount) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const save = structuredClone(game);
    const err = topUpScoutingEngine(save, amount);
    if (err) return err;
    set({ game: save });
    schedulePersist(save);
    return null;
  },

  talk: (playerId, kind) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const save = structuredClone(game);
    const res = talkToPlayerEngine(save, playerId, kind);
    if ("error" in res) return res.error;
    set({ game: save });
    schedulePersist(save);
    return { message: res.message, delta: res.delta };
  },

  answerPress: (index) => {
    const { game } = get();
    if (!game) return { error: "No game loaded." };
    const save = structuredClone(game);
    const res = answerPressEngine(save, index);
    if ("error" in res) return res;
    set({ game: save });
    schedulePersist(save);
    return res;
  },

  skipPress: () => {
    const { game } = get();
    if (!game) return;
    const save = structuredClone(game);
    skipPressEngine(save);
    set({ game: save });
    schedulePersist(save);
  },

  openInboxItem: (id) => {
    const { game } = useGame.getState();
    if (!game) return undefined;
    const r = openInboxItemEngine(game, id);
    set({ game: r.save });
    schedulePersist(r.save);
    return r.screen;
  },

  markInboxAllRead: () => {
    const { game } = get();
    if (!game) return;
    const save = markAllInboxRead(game);
    set({ game: save });
    schedulePersist(save);
  },

  refreshSlots: async () => {
    set({ slots: await listSlots() });
  },

  saveToSlotNow: async (n, name) => {
    const { game } = get();
    if (!game) return "No game loaded.";
    const meta = await saveToSlot(n, game, name);
    set({ slots: await listSlots() });
    return meta ? `Saved to ${meta.name}.` : "Could not write that slot.";
  },

  loadSlotNow: async (n) => {
    const save = await loadSlot(n);
    if (!save) return "That slot is empty.";
    set({ game: save, screen: "home", reveal: null, builderFor: null });
    await persistSave(save);
    set({ slots: await listSlots() });
    return `Loaded ${save.clubs.find((c) => c.id === save.userClubId)?.name ?? "save"} (season ${save.season}).`;
  },

  deleteSlotNow: async (n) => {
    await deleteSlot(n);
    set({ slots: await listSlots() });
  },

  resetGame: () => {
    set({ game: null, screen: "new", reveal: null, builderFor: null });
    void persistSave(null);
  },

  importSave: (save) => {
    set({ game: save, screen: "home", reveal: null, builderFor: null });
    schedulePersist(save);
  }
}));
