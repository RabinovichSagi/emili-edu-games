import { loadState, saveState } from "./storage.js";
import { defaultSrItem, updateSr } from "./sr.js";
import { nowMs } from "./time.js";

function createDefaultState() {
  const profileId = "p1";
  return {
    schemaVersion: 1,
    activeProfileId: profileId,
    profiles: {
      [profileId]: {
        id: profileId,
        name: "ילדה",
        createdAt: nowMs(),
        subjects: {
          english: {
            id: "english",
            titleHe: "אנגלית",
            games: {},
          },
        },
        // per-game item scheduling state:
        // sr[gameId][itemKey] = SrItem
        sr: {},
        // per-game summary stats (for reports)
        gameStats: {},
      },
    },
  };
}

export function createStore() {
  let state = loadState();
  if (!state || state.schemaVersion !== 1) state = createDefaultState();

  const listeners = new Set();
  function emit() {
    for (const l of listeners) l(state);
  }
  function persist() {
    saveState(state);
  }
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function getProfile() {
    return state.profiles[state.activeProfileId];
  }

  function getGameConfig(gameId, defaults) {
    const p = getProfile();
    const cfg = p.subjects.english.games[gameId] || {};
    return { ...defaults, ...cfg };
  }

  function setGameConfig(gameId, patch) {
    const p = getProfile();
    const prev = p.subjects.english.games[gameId] || {};
    p.subjects.english.games[gameId] = { ...prev, ...patch };
    persist();
    emit();
  }

  function getSrItem(gameId, itemKey) {
    const p = getProfile();
    if (!p.sr[gameId]) p.sr[gameId] = {};
    return p.sr[gameId][itemKey] || null;
  }

  function ensureSrItem(gameId, itemKey) {
    const p = getProfile();
    if (!p.sr[gameId]) p.sr[gameId] = {};
    if (!p.sr[gameId][itemKey]) p.sr[gameId][itemKey] = defaultSrItem();
    return p.sr[gameId][itemKey];
  }

  function gradeItem(gameId, itemKey, grade, rtMs) {
    const p = getProfile();
    if (!p.sr[gameId]) p.sr[gameId] = {};
    const current = p.sr[gameId][itemKey] || defaultSrItem();
    p.sr[gameId][itemKey] = updateSr(current, grade, rtMs);

    const gs = (p.gameStats[gameId] ||= {
      lastPlayedAt: 0,
      plays: 0,
      correct: 0,
      wrong: 0,
      avgRtMs: null,
      mastery: 0,
    });
    gs.lastPlayedAt = nowMs();
    gs.plays += 1;
    if (grade >= 3) gs.correct += 1;
    else gs.wrong += 1;
    if (Number.isFinite(rtMs) && rtMs > 0) {
      if (gs.avgRtMs == null) gs.avgRtMs = rtMs;
      else gs.avgRtMs = Math.round(gs.avgRtMs * 0.8 + rtMs * 0.2);
    }

    persist();
    emit();
  }

  function setGameMastery(gameId, mastery) {
    const p = getProfile();
    const gs = (p.gameStats[gameId] ||= {
      lastPlayedAt: 0,
      plays: 0,
      correct: 0,
      wrong: 0,
      avgRtMs: null,
      mastery: 0,
    });
    gs.mastery = Math.max(0, Math.min(100, Math.round(mastery)));
    persist();
    emit();
  }

  function getState() {
    return state;
  }

  return {
    subscribe,
    getState,
    getProfile,
    getGameConfig,
    setGameConfig,
    getSrItem,
    ensureSrItem,
    gradeItem,
    setGameMastery,
  };
}

