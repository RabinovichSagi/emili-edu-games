function randInt(max) {
  return Math.floor(Math.random() * max);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function getRandomBalloonStyle() {
  const r = randInt(255);
  const g = randInt(255);
  const b = randInt(255);
  const left = randInt(92); // vw-ish, we use percent
  const delay = Math.random() * 0.5;
  const dur = 6 + Math.random() * 6;
  const size = 0.78 + Math.random() * 0.55;
  return `
    left: ${left}%;
    background-color: rgba(${r},${g},${b},0.72);
    color: rgba(${r},${g},${b},0.72);
    box-shadow: inset -7px -3px 10px rgba(${Math.max(0, r - 20)},${Math.max(0, g - 20)},${Math.max(0, b - 20)},0.55);
    animation: floatUp ${dur}s ease-in ${delay}s both;
    transform: scale(${size});
  `;
}

export function showBalloonCelebration({
  count = 26,
  maxSeconds = 10,
  onDone = null,
} = {}) {
  const balloonCount = clamp(count, 6, 60);

  const overlay = document.createElement("div");
  overlay.className = "balloonOverlay";

  const container = document.createElement("div");
  container.className = "balloonContainer";
  overlay.append(container);

  let popped = 0;
  function maybeDone() {
    if (popped >= balloonCount) close();
  }

  function close() {
    overlay.classList.add("hidden");
    window.setTimeout(() => overlay.remove(), 520);
    if (typeof onDone === "function") onDone();
  }

  for (let i = 0; i < balloonCount; i++) {
    const b = document.createElement("div");
    b.className = "balloon";
    b.style.cssText = getRandomBalloonStyle();
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (b.classList.contains("pop")) return;
      b.classList.add("pop");
      popped += 1;
      window.setTimeout(() => b.remove(), 200);
      maybeDone();
    });
    container.append(b);
  }

  // Allow tapping the background to close early (optional “skip”).
  overlay.addEventListener("click", close);

  document.body.append(overlay);

  // Auto close after maxSeconds to avoid trapping the UI.
  window.setTimeout(close, clamp(maxSeconds, 3, 20) * 1000);

  return { close };
}

