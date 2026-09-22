import { create } from "zustand";
import type {
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
  T
} from "@/engine";
import type { BidResponse } from "@/engine";
import type { AttrKey, CornerRoutine, FreeKickRoutine, TrainingPlan } from "@/engine";
import { cleanSetPieces } from "@/engine";
import { loadSave, persistSave } from "./save";

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
  | "seasonEnd"
  | "builder";
export type SlotRef = { kind: "xi" | "bench"; index: number };

interface AppState {
  loaded: boolean;
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
  bidFor: (playerId: string, fee: number) => BidResponse | null;
  signTerms: (playerId: string, wage: number) => BidResponse | null;
  renew: (playerId: string, wage: number) => BidResponse | null;
  signFree: (playerId: string, wage: number) => BidResponse | null;
  acceptIncoming: (offerId: string) => BidResponse | null;
  rejectIncoming: (offerId: string) => void;
  cancelDeal: () => void;
  setTraining: (patch: Partial<TrainingPlan>) => void;
  setFocus: (playerId: string, focus: AttrKey | null) => void;
  setRoutine: (kind: "corner" | "freekick", routine: string) => void;
  setTaker: (kind: "corner" | "freekick" | "penalty", playerId: string | null) => void;
  resetGame: () => void;
  importSave: (save: SaveGame) => void;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
let lastPlayheadPersist = 0;
const schedulePersist = (game: SaveGame | null) => {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void persistSave(game);
  }, 400);
};

const defFor = (game: SaveGame, id: string): FormationDef =>
  resolveFormation(id, game.customFormations) ?? builtinFormation("4-3-3");

/** The match is finished once the playback has reached the end of the second half. */
const matchOver = (live: NonNullable<SaveGame["live"]>): boolean =>
  live.half === 2 && live.playhead >= live.state.total;

export const useGame = create<AppState>()((set, get) => ({
  loaded: false,
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

  bidFor: (playerId, fee) => {
    const { game } = get();
    if (!game) return null;
    const r = bidForPlayer(game, playerId, fee);
    set({ game: r.save });
    schedulePersist(r.save);
    return r.resp;
  },

  signTerms: (playerId, wage) => {
    const { game } = get();
    if (!game) return null;
    const r = offerTerms(game, playerId, wage);
    set({ game: r.save });
    schedulePersist(r.save);
    return r.resp;
  },

  renew: (playerId, wage) => {
    const { game } = get();
    if (!game) return null;
    const r = renewContract(game, playerId, wage);
    set({ game: r.save });
    schedulePersist(r.save);
    return r.resp;
  },

  signFree: (playerId, wage) => {
    const { game } = get();
    if (!game) return null;
    const r = signFreeAgent(game, playerId, wage);
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

  resetGame: () => {
    set({ game: null, screen: "new", reveal: null, builderFor: null });
    void persistSave(null);
  },

  importSave: (save) => {
    set({ game: save, screen: "home", reveal: null, builderFor: null });
    schedulePersist(save);
  }
}));
