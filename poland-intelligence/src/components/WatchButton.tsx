'use client';

import { useEffect, useState } from 'react';
import { addWatch, detectChanges, isWatched, removeWatch, type WatchItem } from '@/lib/watchlist';

export default function WatchButton({ item }: { item: Omit<WatchItem, 'addedAt'> }) {
  const [watched, setWatched] = useState(false);
  const [changed, setChanged] = useState(0);

  useEffect(() => {
    setWatched(isWatched(item.id));
    setChanged(detectChanges(item.id, item.snapshot, 'Poland Intelligence').length);
  }, [item.id, item.snapshot]);

  return (
    <div className="text-right">
      <button
        className={watched ? 'btn border-accent text-accent' : 'btn'}
        onClick={() => {
          if (watched) { removeWatch(item.id); setWatched(false); }
          else { addWatch(item); setWatched(true); }
        }}
      >
        {watched ? '★ Obserwowane' : '☆ Obserwuj'}
      </button>
      {changed > 0 && <p className="mt-1 text-[11px] text-warn">Change detected ({changed})</p>}
    </div>
  );
}
