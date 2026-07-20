import { useRef, useEffect } from 'react';
import { createGardenSketch } from '../garden/sketch';

/**
 * Garden — main visual component.
 *
 * Layout is incremental: existing blobs keep their position, new blobs
 * start at canvas center and drift apart via force simulation.
 * Radius-aware edge clamping prevents blobs from being cut off at boundaries.
 */
export default function Garden({ analyses = [], onBlobClick }) {
  const containerRef = useRef(null);
  const p5Ref = useRef(null);
  const positionsRef = useRef(new Map()); // id → { x, y, r }
  const blobDataRef = useRef([]);        // latest blob display data (for click detection)
  const clickRef = useRef(onBlobClick);
  clickRef.current = onBlobClick;

  useEffect(() => {
    if (p5Ref.current) return;

    const container = containerRef.current;
    container.querySelectorAll('canvas').forEach(el => el.remove());
    const p5 = createGardenSketch(container);
    p5Ref.current = p5;

    return () => {
      // StrictMode dev: setup() hasn't run yet (rAF pending), so p5.remove()
      // is a no-op. Keep p5Ref.current set to block the second mount.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const p5 = p5Ref.current;
    if (!p5) return;

    if (!analyses || analyses.length === 0) {
      positionsRef.current.clear();
      p5.setBlobs([]);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    const cw = rect?.width || p5.width || 800;
    const ch = rect?.height || p5.height || 400;

    const count = analyses.length;

    // Radius per blob: proportional to track_count relative to max
    const maxTracks = Math.max(...analyses.map(a => a.track_count || 1), 1);
    const rMin = Math.max(14, Math.round(50 / Math.pow(count, 0.35)));
    const rMax = Math.max(28, Math.round(105 / Math.pow(count, 0.35)));
    const rRange = rMax - rMin;

    // ── Build positions: keep existing, new ones start at center ──

    const existingIds = new Set(analyses.map(a => a.id));
    const store = positionsRef.current;

    // Remove ids that no longer exist
    for (const id of store.keys()) {
      if (!existingIds.has(id)) store.delete(id);
    }

    // ── Build positions: existing keep their spot, new ones placed randomly ──
    // Random sampling across canvas, tries up to 120 spots before fallback.
    const minSep = 2.6;

    const positions = analyses.map((a) => {
      const existing = store.get(a.id);
      const t = Math.min(1, (a.track_count || 1) / maxTracks);
      const r = Math.round(rMin + t * rRange);

      if (existing) {
        existing.r = r;
        return existing;
      }

      // New blob — random position that doesn't overlap any existing blob
      const existingBlobs = Array.from(store.values());
      const ep = r + 22;

      for (let attempt = 0; attempt < 120; attempt++) {
        const cx = ep + Math.random() * (cw - ep * 2);
        const cy = ep + Math.random() * (ch - ep * 2);

        const ok = !existingBlobs.some(b => {
          const d = Math.hypot(cx - b.x, cy - b.y);
          return d < (r + b.r) * minSep;
        });

        if (ok) {
          const entry = { x: cx, y: cy, r };
          store.set(a.id, entry);
          return entry;
        }
      }

      // Fallback — center-ish area (relaxation pass cleans up overlap)
      const entry = { x: Math.random() * cw, y: Math.random() * ch, r };
      store.set(a.id, entry);
      return entry;
    });

    // ── Light relaxation pass ──
    // Only nudge if unavoidable overlap happened (e.g. canvas too full).
    // Track max overlap and stop early when resolved.
    const edgePad2 = (p) => p.r + 22;
    let maxOverlap = Infinity;
    for (let iter = 0; iter < 200 && maxOverlap > 0.5; iter++) {
      maxOverlap = 0;
      for (let i = 0; i < count; i++) {
        const pi = positions[i];
        let fx = 0, fy = 0;

        for (let j = 0; j < count; j++) {
          if (i === j) continue;
          const pj = positions[j];
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const dist = Math.hypot(dx, dy) + 0.001;
          const ideal = (pi.r + pj.r) * minSep;
          if (dist < ideal) {
            const overlap = ideal - dist;
            if (overlap > maxOverlap) maxOverlap = overlap;
            const push = overlap * 0.5 * 0.55;
            fx += (dx / dist) * push;
            fy += (dy / dist) * push;
          }
        }

        const ep = edgePad2(pi);
        if (pi.x - ep < 0) fx += (ep - pi.x) * 0.55;
        else if (pi.x + ep > cw) fx -= (pi.x + ep - cw) * 0.55;
        if (pi.y - ep < 0) fy += (ep - pi.y) * 0.55;
        else if (pi.y + ep > ch) fy -= (pi.y + ep - ch) * 0.55;

        fx += (cw / 2 - pi.x) * 0.005;
        fy += (ch / 2 - pi.y) * 0.005;

        pi.x += fx;
        pi.y += fy;

        const ep2 = edgePad2(pi);
        pi.x = Math.max(ep2, Math.min(cw - ep2, pi.x));
        pi.y = Math.max(ep2, Math.min(ch - ep2, pi.y));
      }
    }

    const bd = analyses.map((a, i) => {
      return { id: a.id, playlist_id: a.playlist_id, x: positions[i].x, y: positions[i].y, r: positions[i].r, mood_tag: a.mood_tags?.[0] || 'neutral', playlistName: a.playlist_name };
    });

    // No background style — always black with particles
    p5.setBlobs(bd);
    // Keep a copy of the final blob data for click detection
    blobDataRef.current = bd;
  }, [analyses]);

  const isEmpty = !analyses || analyses.length === 0;

  const handleClick = (e) => {
    if (isEmpty) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    // Check against display blob data (p5 lerps toward these targets)
    const blobs = blobDataRef.current;
    for (const blob of blobs) {
      if (Math.hypot(cx - blob.x, cy - blob.y) < blob.r + 20) {
        clickRef.current?.(blob);
        return;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`garden-container${isEmpty ? ' garden-container-empty' : ''}`}
    >
      {isEmpty && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 2
        }}>
          <div className="garden-empty-text">Analyze a playlist to grow your garden</div>
          <div className="garden-empty-hint">Your music-self blooms with every analysis</div>
        </div>
      )}
      {!isEmpty && (
        <div style={{
          position: 'absolute', bottom: 'var(--space-4)', left: 'var(--space-4)',
          pointerEvents: 'none', zIndex: 2
        }}>
          <div className="garden-blob-count">
            {analyses.length} {analyses.length === 1 ? 'bloom' : 'blooms'}
          </div>
        </div>
      )}
    </div>
  );
}
