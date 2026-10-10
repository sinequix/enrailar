/**
 * El script de Turnstile se inserta una sola vez. Si el formulario se oculta
 * antes del `load` (la ficha restaurada desde localStorage), el listener se
 * suelta y el evento ya no vuelve a dispararse. La próxima vez hay que mirar
 * si la API ya está en la página.
 */
export interface TurnstileScriptHandle {
  readonly loaded: boolean;
  addLoadListener(listener: () => void): void;
  removeLoadListener(listener: () => void): void;
  markLoaded(): void;
  mount(): void;
}

export interface TurnstileScriptDom {
  apiReady(): boolean;
  findScript(): TurnstileScriptHandle | null;
  createScript(): TurnstileScriptHandle;
}

export function watchTurnstileScript(dom: TurnstileScriptDom, onReady: () => void): () => void {
  if (dom.apiReady()) {
    onReady();
    return () => {};
  }
  const existing = dom.findScript();
  const script = existing ?? dom.createScript();
  if (script.loaded || dom.apiReady()) {
    onReady();
    return () => {};
  }
  const listener = () => {
    script.markLoaded();
    onReady();
  };
  script.addLoadListener(listener);
  if (!existing) script.mount();
  if (script.loaded || dom.apiReady()) {
    script.removeLoadListener(listener);
    if (!script.loaded) script.markLoaded();
    onReady();
    return () => {};
  }
  return () => script.removeLoadListener(listener);
}
