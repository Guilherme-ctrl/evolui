/**
 * Schedules work after the current React commit so state updates are not treated as
 * synchronous setState inside an effect body (eslint react-hooks/set-state-in-effect).
 */
export function runDeferredEffect(work: () => void): () => void {
  const id = window.setTimeout(work, 0);
  return () => window.clearTimeout(id);
}
