const cache = new Map();

export function playOneShot(src, { volume = 1 } = {}) {
  try {
    const a = new Audio(src);
    a.volume = volume;
    // Fire-and-forget
    a.play().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export async function playCached(src, { volume = 1 } = {}) {
  try {
    let a = cache.get(src);
    if (!a) {
      a = new Audio(src);
      cache.set(src, a);
    }
    a.pause();
    a.currentTime = 0;
    a.volume = volume;
    await a.play();
    return true;
  } catch {
    return false;
  }
}

export function preloadAudio(srcList) {
  for (const src of srcList) {
    try {
      if (cache.has(src)) continue;
      const a = new Audio(src);
      a.preload = "auto";
      a.load();
      cache.set(src, a);
    } catch {
      // ignore
    }
  }
}
