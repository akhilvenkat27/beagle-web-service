import { useEffect, useRef } from 'react';

/**
 * Re-runs the latest `load` every `intervalMs`, and when the tab becomes visible or the window gains focus.
 */
export function usePeriodicRefresh(load, intervalMs = 20000) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const run = () => loadRef.current();
    const id = window.setInterval(run, intervalMs);
    const onVis = () => {
      if (document.visibilityState === 'visible') run();
    };
    const onFocus = () => run();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [intervalMs]);
}
