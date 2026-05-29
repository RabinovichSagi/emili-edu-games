import { clear, el, toast } from "../../../ui/dom.js";
import { nowMs } from "../../../core/time.js";
import { getParasha, latestParashaId, parashotForBook, TORAH_BOOKS, TORAH_PARASHOT } from "./content.js";

const GAME_ID = "torah_picture_sequence";
const SUBJECT_ID = "torah";
const CREATED_AT = 20260529;

function defaultConfig() {
  return {
    parashaId: latestParashaId(),
    difficulty: 1,
    roundsPerSession: 4,
  };
}

function normalizeConfig(cfg) {
  const next = { ...defaultConfig(), ...cfg };
  if (!getParasha(next.parashaId)) next.parashaId = latestParashaId();
  next.difficulty = Math.max(1, Math.min(3, Number(next.difficulty) || 1));
  next.roundsPerSession = Math.max(2, Math.min(8, Number(next.roundsPerSession) || 4));
  return next;
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function storyCardsForDifficulty(story, difficulty) {
  const ordered = [...story.cards].sort((a, b) => a.order - b.order);
  const count = Math.min(ordered.length, Math.max(story.minCards || 4, difficulty + 3));
  return ordered.slice(0, count);
}

function makeRound(parasha, cfg) {
  const stories = parasha.stories.filter((story) => story.cards.length >= 4);
  const story = stories[Math.floor(Math.random() * stories.length)];
  const cards = storyCardsForDifficulty(story, cfg.difficulty);
  return {
    parasha,
    story,
    orderedCards: cards,
    tray: shuffle(cards).map((card) => ({ ...card })),
    slots: Array(cards.length).fill(null),
  };
}

function currentItemKey(round) {
  return round.story.itemKey || `${round.parasha.id}|${round.story.id}|${round.orderedCards.length}`;
}

function computeMastery(profile) {
  const sr = profile.sr?.[GAME_ID] || {};
  const items = Object.values(sr);
  if (!items.length) return 0;
  let sum = 0;
  let weight = 0;
  for (const item of items) {
    const attempts = (item.correct || 0) + (item.wrong || 0);
    if (!attempts) continue;
    const confidence = Math.min(1, attempts / 4);
    const accuracy = (item.correct || 0) / attempts;
    const streakBonus = Math.min(0.18, (item.streak || 0) * 0.03);
    sum += Math.min(1, accuracy * 0.82 + confidence * 0.12 + streakBonus);
    weight += 1;
  }
  return weight ? Math.round((sum / weight) * 100) : 0;
}

function areSlotsFull(slots) {
  return slots.every(Boolean);
}

function evaluate(round) {
  const wrongIndexes = [];
  round.slots.forEach((card, index) => {
    if (!card || card.id !== round.orderedCards[index].id) wrongIndexes.push(index);
  });
  return { ok: wrongIndexes.length === 0, wrongIndexes };
}

export const TorahPictureSequenceGame = {
  id: GAME_ID,
  titleHe: "רצף תמונות בפרשה",
  subtitleHe: "מסדרים סיפור מהפרשה לפי הסדר הנכון 🖼️",
  createdAt: CREATED_AT,

  render({ mount, store, router }) {
    const state = {
      phase: "menu",
      cfg: normalizeConfig(store.getGameConfig(GAME_ID, defaultConfig(), SUBJECT_ID)),
      roundNumber: 0,
      score: 0,
      round: null,
      promptAt: 0,
      feedback: "",
      wrongIndexes: [],
      attemptsForRound: 0,
      rapidMoves: 0,
      lastMoveAt: 0,
      carefulMode: false,
      lockUntil: 0,
      seenHint: false,
      selectedCardId: "",
    };

    function saveConfig(patch) {
      state.cfg = normalizeConfig({ ...state.cfg, ...patch });
      store.setGameConfig(GAME_ID, state.cfg, SUBJECT_ID);
      rerender();
    }

    function startSession() {
      state.phase = "play";
      state.roundNumber = 0;
      state.score = 0;
      nextRound();
    }

    function nextRound() {
      const parasha = getParasha(state.cfg.parashaId);
      state.roundNumber += 1;
      state.round = makeRound(parasha, state.cfg);
      state.promptAt = nowMs();
      state.feedback = state.round.story.promptHe;
      state.wrongIndexes = [];
      state.attemptsForRound = 0;
      state.seenHint = false;
      state.selectedCardId = "";
      store.ensureSrItem(GAME_ID, currentItemKey(state.round));
      rerender();
    }

    function finishSession() {
      state.phase = "done";
      store.setGameMastery(GAME_ID, computeMastery(store.getProfile()));
      rerender();
    }

    function maybeFlagGuessing() {
      const t = nowMs();
      if (state.lastMoveAt && t - state.lastMoveAt < 650) state.rapidMoves += 1;
      else state.rapidMoves = Math.max(0, state.rapidMoves - 1);
      state.lastMoveAt = t;
      if (state.rapidMoves >= 4) {
        state.carefulMode = true;
        state.lockUntil = Date.now() + 900;
        state.feedback = "רגע קטן 🌷 נסתכל על התמונות ואז נסדר בזהירות.";
        toast("בואו נעצור שנייה ונחשוב על הסיפור 👀", 6500);
      }
    }

    function placeCard(cardId, slotIndex) {
      if (Date.now() < state.lockUntil || !state.round) return;
      maybeFlagGuessing();
      const card = state.round.tray.find((c) => c.id === cardId) || state.round.slots.find((c) => c?.id === cardId);
      if (!card) return;
      state.round.slots = state.round.slots.map((slot) => (slot?.id === cardId ? null : slot));
      state.round.slots[slotIndex] = card;
      state.selectedCardId = "";
      state.wrongIndexes = state.wrongIndexes.filter((idx) => idx !== slotIndex);
      rerender();
    }

    function removeFromSlot(slotIndex) {
      if (Date.now() < state.lockUntil || !state.round) return;
      state.round.slots[slotIndex] = null;
      state.selectedCardId = "";
      rerender();
    }

    function onCardTap(cardId) {
      if (Date.now() < state.lockUntil || !state.round) return;
      const emptyIndex = state.round.slots.findIndex((slot) => !slot);
      if (emptyIndex !== -1 && !state.carefulMode) placeCard(cardId, emptyIndex);
      else {
        state.selectedCardId = state.selectedCardId === cardId ? "" : cardId;
        state.feedback = "בחרו מקום לסיפור, מימין לשמאל 📍";
        rerender();
      }
    }

    function onSlotTap(slotIndex) {
      if (state.selectedCardId) placeCard(state.selectedCardId, slotIndex);
      else if (state.round?.slots[slotIndex]) removeFromSlot(slotIndex);
    }

    function showHint() {
      if (!state.round) return;
      state.seenHint = true;
      const firstWrong = evaluate(state.round).wrongIndexes[0] ?? 0;
      const correctCard = state.round.orderedCards[firstWrong];
      state.feedback = `רמז: במקום ${firstWrong + 1} מתאים: ${correctCard.hintHe}`;
      toast(state.feedback, 8000);
      rerender();
    }

    function checkAnswer() {
      if (!state.round || !areSlotsFull(state.round.slots)) {
        state.feedback = "קודם ממלאים את כל המקומות בתמונות 🙂";
        rerender();
        return;
      }
      const rt = Math.max(400, nowMs() - state.promptAt);
      const result = evaluate(state.round);
      state.attemptsForRound += 1;
      state.wrongIndexes = result.wrongIndexes;
      const blindGuessSignals = rt < 5000 || state.rapidMoves >= 4;

      if (result.ok) {
        const grade = state.attemptsForRound === 1 && !blindGuessSignals ? 5 : state.attemptsForRound <= 2 ? 4 : 3;
        store.gradeItem(GAME_ID, currentItemKey(state.round), grade, rt);
        state.score += Math.max(1, 4 - state.attemptsForRound);
        state.feedback = "איזה סדר נהדר! הסיפור התחבר 🌟";
        if (state.roundNumber >= state.cfg.roundsPerSession) setTimeout(finishSession, 650);
        else setTimeout(nextRound, 850);
      } else {
        const grade = blindGuessSignals ? 1 : 2;
        store.gradeItem(GAME_ID, currentItemKey(state.round), grade, rt);
        state.carefulMode = state.carefulMode || blindGuessSignals || state.attemptsForRound >= 2;
        state.feedback = state.carefulMode
          ? "כמעט! המקומות המסומנים צריכים מחשבה. פתחו רמז ונסו שוב בעדינות 💡"
          : "כמעט! יש כמה תמונות שצריכות להתחלף. נסו שוב 🙂";
        if (blindGuessSignals) state.lockUntil = Date.now() + 1200;
      }
      store.setGameMastery(GAME_ID, computeMastery(store.getProfile()));
      rerender();
    }

    function rerender() {
      clear(mount);
      if (state.phase === "play") renderPlay();
      else if (state.phase === "settings") renderSettings();
      else if (state.phase === "done") renderDone();
      else renderMenu();
    }

    function renderMenu() {
      const parasha = getParasha(state.cfg.parashaId);
      const book = TORAH_BOOKS.find((b) => b.id === parasha.bookId);
      mount.append(
        el("div", { class: "list" }, [
          el("div", { class: "itemRow" }, [
            el("div", {}, [
              el("div", { class: "title", text: "רצף תמונות בפרשה 🖼️" }),
              el("div", { class: "sub", text: "בוחרים פרשה, רואים תמונות, ומרכיבים את הסיפור לפי הסדר." }),
            ]),
            el("button", { class: "btn secondary", onClick: () => router.push({ subject: SUBJECT_ID }) }, ["חזרה"]),
          ]),
          el("div", { class: "card torahHero" }, [
            el("div", { class: "title", text: `הפרשה שנבחרה: ${book?.titleHe || ""} • ${parasha.titleHe}` }),
            el("div", { class: "sub", text: parasha.subtitleHe }),
            el("div", { class: "row", style: "margin-top:12px" }, [
              el("button", { class: "btn", onClick: startSession }, ["להתחיל לסדר ✨"]),
              el("button", { class: "btn secondary", onClick: () => (state.phase = "settings") && rerender() }, ["בחירת פרשה"]),
            ]),
          ]),
          el("div", { class: "row" }, [
            el("span", { class: "pill", text: `רמות: ${state.cfg.difficulty === 1 ? "4 תמונות" : state.cfg.difficulty === 2 ? "5 תמונות" : "6+ תמונות"}` }),
            el("span", { class: "pill", text: `${state.cfg.roundsPerSession} סיבובים קצרים` }),
            el("span", { class: "pill", text: "רמזים לפני תסכול 💡" }),
          ]),
        ])
      );
    }

    function renderSettings() {
      mount.append(
        el("div", { class: "list" }, [
          el("div", { class: "itemRow" }, [
            el("div", {}, [
              el("div", { class: "title", text: "בחירת חומש ופרשה 📜" }),
              el("div", { class: "sub", text: "ברירת המחדל היא תמיד הפרשה האחרונה שנוספה למשחק." }),
            ]),
            el("button", { class: "btn secondary", onClick: () => (state.phase = "menu") && rerender() }, ["סיום"]),
          ]),
          ...TORAH_BOOKS.map((book) => renderBookSection(book)),
          el("div", { class: "card" }, [
            el("label", { class: "sub", text: "רמת קושי" }),
            el("div", { class: "row", style: "margin-top:8px" }, [1, 2, 3].map((level) =>
              el("button", { class: `btn ${state.cfg.difficulty === level ? "" : "secondary"}`, onClick: () => saveConfig({ difficulty: level }) }, [
                level === 1 ? "קל: 4" : level === 2 ? "בינוני: 5" : "מתקדם: 6+",
              ])
            )),
          ]),
        ])
      );
    }

    function renderBookSection(book) {
      const parashot = parashotForBook(book.id);
      return el("div", { class: "card" }, [
        el("div", { class: "title", text: `${book.emoji} חומש ${book.titleHe}` }),
        parashot.length
          ? el("div", { class: "parashaGrid" }, parashot.map((p) =>
              el("button", { class: `parashaBtn ${state.cfg.parashaId === p.id ? "active" : ""}`, onClick: () => saveConfig({ parashaId: p.id }) }, [
                el("strong", { text: p.titleHe }),
                el("span", { text: p.subtitleHe }),
              ])
            ))
          : el("div", { class: "sub", text: "עדיין אין סיפורים זמינים בחומש הזה." }),
      ]);
    }

    function renderPlay() {
      const round = state.round;
      const usedIds = new Set(round.slots.filter(Boolean).map((card) => card.id));
      const available = round.tray.filter((card) => !usedIds.has(card.id));
      mount.append(
        el("div", { class: "list sequenceGame" }, [
          el("div", { class: "itemRow" }, [
            el("div", {}, [
              el("div", { class: "title", text: `${round.parasha.titleHe}: ${round.story.titleHe}` }),
              el("div", { class: "sub", text: `סיבוב ${state.roundNumber}/${state.cfg.roundsPerSession} • סדרו מימין לשמאל` }),
            ]),
            el("button", { class: "btn secondary", onClick: () => (state.phase = "menu") && rerender() }, ["יציאה"]),
          ]),
          el("div", { class: `feedbackCard ${state.wrongIndexes.length ? "needsWork" : ""}`, text: state.feedback }),
          el("div", { class: "sequenceSlots", style: `--sequence-count:${round.slots.length}` },
            round.slots.map((card, idx) => renderSlot(card, idx))
          ),
          el("div", { class: "sequenceTray" }, available.map((card) => renderCard(card, false))),
          el("div", { class: "row" }, [
            el("button", { class: "btn", onClick: checkAnswer }, ["בדיקה"]),
            el("button", { class: "btn secondary", onClick: showHint }, [state.seenHint ? "עוד רמז" : "רמז"]),
            el("button", { class: "btn secondary", onClick: () => { state.round.slots = Array(round.slots.length).fill(null); state.wrongIndexes = []; rerender(); } }, ["ניקוי"]),
          ]),
        ])
      );
    }

    function renderSlot(card, idx) {
      return el("button", { class: `sequenceSlot ${state.wrongIndexes.includes(idx) ? "wrong" : ""}`, onClick: () => onSlotTap(idx) }, [
        el("span", { class: "slotNumber", text: String(idx + 1) }),
        card ? renderCard(card, true) : el("span", { class: "emptySlot", text: "הניחו תמונה" }),
      ]);
    }

    function renderCard(card, inSlot) {
      return el("div", { class: `sequenceCard ${state.selectedCardId === card.id ? "selected" : ""} ${inSlot ? "inSlot" : ""}`, onClick: inSlot ? null : () => onCardTap(card.id) }, [
        el("img", { src: card.image, alt: card.altHe, loading: "lazy" }),
        el("div", { class: "sequenceCardTitle", text: card.titleHe }),
      ]);
    }

    function renderDone() {
      mount.append(
        el("div", { class: "list" }, [
          el("div", { class: "bigPrompt" }, ["כל הכבוד!", el("small", { text: `אספתם ${state.score} כוכבים של סדר וסיפור ⭐` })]),
          el("div", { class: "row", style: "justify-content:center" }, [
            el("button", { class: "btn", onClick: startSession }, ["עוד סיפור"]),
            el("button", { class: "btn secondary", onClick: () => (state.phase = "menu") && rerender() }, ["לתפריט המשחק"]),
          ]),
        ])
      );
    }

    rerender();
  },
};
