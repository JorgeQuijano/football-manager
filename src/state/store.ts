import { create } from "zustand";
import type { FormationId, Lineup, MatchResult, Mentality, SaveGame } from "@/engine";
import {
  autoLineup,
  newGame,
  nextSeason,
  playRound,
  seasonRounds,
  squadOf
} from "@/engine";
import { loadSave, persistSave } from "./save";

export type Screen = "new" | "home" | "squad" | "tactics" | "league" | "match" | "seasonEnd";

interface AppState {
  loaded: boolean;
  game: SaveGame | null;
  screen: Screen;
  reveal: MatchResult | null;

  init: () => Promise<void>;
  startNewGame: (clubId: string) => void;
  advance: () => void;
  finishMatch: () => void;
  startNextSeason: () => void;
  setScreen: (s: Screen) => void;
  setFormation: (f: FormationId) => void;
  setMentality: (m: Mentality) => void;
  assignPlayer: (kind: "xi" | "bench", index: number, playerId: string) => void;
  clearSlot: (kind: "xi" | "bench", index: number) => void;
  autoPick: () => void;
  resetGame: () => void;
  importSave: (save: SaveGame) => void;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
const schedulePersist = (game: SaveGame | null) => {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void persistSave(game);
  }, 400);
};

export const useGame = create<AppState>()((set, get) => ({
  loaded: false,
  game: null,
  screen: "new",
  reveal: null,

  init: async () => {
    const save = await loadSave();
    set({ game: save, loaded: true, screen: save ? "home" : "new" });
  },

  startNewGame: (clubId) => {
    const seed = Math.floor(Math.random() * 1_000_000) + 1;
    const game = newGame(seed, clubId);
    set({ game, screen: "home", reveal: null });
    schedulePersist(game);
  },

  advance: () => {
    const { game } = get();
    if (!game) return;
    if (game.round > seasonRounds(game)) {
      set({ screen: "seasonEnd" });
      return;
    }
    const { save, userMatch } = playRound(game);
    set({ game: save, reveal: userMatch ?? null, screen: userMatch ? "match" : "home" });
    schedulePersist(save);
  },

  finishMatch: () => {
    const { game } = get();
    if (!game) return;
    set({
      reveal: null,
      screen: game.round > seasonRounds(game) ? "seasonEnd" : "home"
    });
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
    if (!game) return;
    const lineup = autoLineup(squadOf(game.players, game.userClubId), formation);
    lineup.mentality = game.lineup.mentality;
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

  autoPick: () => {
    const { game } = get();
    if (!game) return;
    const lineup = autoLineup(squadOf(game.players, game.userClubId), game.lineup.formation);
    lineup.mentality = game.lineup.mentality;
    const save = { ...game, lineup };
    set({ game: save });
    schedulePersist(save);
  },

  resetGame: () => {
    set({ game: null, screen: "new", reveal: null });
    void persistSave(null);
  },

  importSave: (save) => {
    set({ game: save, screen: "home", reveal: null });
    schedulePersist(save);
  }
}));
