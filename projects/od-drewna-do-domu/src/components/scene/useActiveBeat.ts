import { useEffect, useState } from 'react';
import { beatAt, type Beat } from './journeyConfig';
import { subscribeScroll } from './scrollStore';

/** Re-renders the DOM overlay only when the active beat actually changes, not on every scroll tick. */
export function useActiveBeat(): Beat {
  const [beat, setBeat] = useState<Beat>(() => beatAt(0));

  useEffect(() => {
    return subscribeScroll((t) => {
      const next = beatAt(t);
      setBeat((prev) => (prev.id === next.id ? prev : next));
    });
  }, []);

  return beat;
}
