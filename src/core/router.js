export function createRouter() {
  const listeners = new Set();

  function read() {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    return {
      screen: params.get("screen") || "",
      subject: params.get("subject") || "",
      game: params.get("game") || "",
    };
  }

  function replace(params) {
    const url = new URL(window.location.href);
    url.search = "";
    const sp = url.searchParams;
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      sp.set(k, String(v));
    }
    history.replaceState({}, "", url.toString());
    for (const l of listeners) l();
  }

  function push(params) {
    const url = new URL(window.location.href);
    url.search = "";
    const sp = url.searchParams;
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      sp.set(k, String(v));
    }
    history.pushState({}, "", url.toString());
    for (const l of listeners) l();
  }

  function onChange(fn) {
    listeners.add(fn);
    window.addEventListener("popstate", fn);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("popstate", fn);
    };
  }

  return { read, replace, push, onChange };
}

