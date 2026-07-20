/**
 * Garden p5 sketch — floating particles background + Houston blobs.
 * One canvas, instance mode, managed by React lifecycle.
 */

import P5 from 'p5';

const BLOB_PS = {
  energetic:     { h: 35,  s: 80, l: 75, ba: 0.14, sp: 0.012, na: 55 },
  upbeat:        { h: 45,  s: 75, l: 72, ba: 0.11, sp: 0.010, na: 48 },
  neutral:       { h: 210, s: 40, l: 68, ba: 0.08, sp: 0.007, na: 38 },
  melancholic:   { h: 220, s: 45, l: 58, ba: 0.05, sp: 0.004, na: 28 },
  dark:          { h: 230, s: 30, l: 40, ba: 0.04, sp: 0.003, na: 22 },
  contemplative: { h: 210, s: 35, l: 63, ba: 0.06, sp: 0.005, na: 32 },
  dreamy:        { h: 280, s: 50, l: 72, ba: 0.07, sp: 0.006, na: 42 },
  peaceful:      { h: 170, s: 45, l: 68, ba: 0.05, sp: 0.005, na: 35 },
  nostalgic:     { h: 30,  s: 55, l: 62, ba: 0.06, sp: 0.005, na: 30 },
  romantic:      { h: 340, s: 55, l: 68, ba: 0.08, sp: 0.007, na: 38 },
  playful:       { h: 15,  s: 75, l: 72, ba: 0.12, sp: 0.010, na: 50 },
  groovy:        { h: 270, s: 60, l: 55, ba: 0.10, sp: 0.009, na: 45 },
  ethereal:      { h: 190, s: 30, l: 78, ba: 0.05, sp: 0.004, na: 40 },
  angry:         { h: 0,   s: 70, l: 55, ba: 0.15, sp: 0.015, na: 60 },
  anxious:       { h: 75,  s: 65, l: 60, ba: 0.13, sp: 0.012, na: 48 },
  cozy:          { h: 25,  s: 45, l: 50, ba: 0.04, sp: 0.004, na: 28 },
  hopeful:       { h: 140, s: 55, l: 65, ba: 0.07, sp: 0.006, na: 38 },
  bittersweet:   { h: 330, s: 40, l: 58, ba: 0.06, sp: 0.005, na: 32 },
  tender:        { h: 310, s: 35, l: 68, ba: 0.05, sp: 0.004, na: 30 },
  joyful:        { h: 50,  s: 80, l: 75, ba: 0.14, sp: 0.012, na: 55 },
  sad:           { h: 240, s: 35, l: 50, ba: 0.04, sp: 0.003, na: 24 },
  calm:          { h: 200, s: 35, l: 70, ba: 0.05, sp: 0.005, na: 34 },
  warm:          { h: 20,  s: 60, l: 65, ba: 0.08, sp: 0.007, na: 40 },
  mysterious:    { h: 260, s: 40, l: 45, ba: 0.06, sp: 0.004, na: 28 },
  epic:          { h: 250, s: 55, l: 55, ba: 0.11, sp: 0.010, na: 50 },
};

function moodToColor(mood) {
  const lower = (mood || '').toLowerCase().trim();
  if (lower && BLOB_PS[lower]) return BLOB_PS[lower];
  if (lower) {
    for (const [key, val] of Object.entries(BLOB_PS)) {
      if (lower.includes(key) || key.includes(lower)) return val;
    }
  }
  let hash = 0;
  for (let i = 0; i < (lower || 'neutral').length; i++) {
    hash = ((hash << 5) - hash) + (lower || 'neutral').charCodeAt(i);
    hash |= 0;
  }
  const h = ((hash % 360) + 360) % 360;
  return { h, s: 55, l: 65, ba: 0.07, sp: 0.006, na: 38 };
}

export function createGardenSketch(container) {
  const sketch = (p) => {
    let particles = [];
    let blobs = [];
    let zoff = 0;
    let hoveredBlobId = null;

    class Particle {
      constructor() {
        this.x = Math.random() * (p.width || 800);
        this.y = Math.random() * (p.height || 500);
        this.r = 0.8 + Math.random() * 2.2;
        this.opa = 0.08 + Math.random() * 0.18;
        // Noise-based random walk offsets
        this.noffX = Math.random() * 1000;
        this.noffY = Math.random() * 1000;
      }
      update() {
        const speed = 0.6;
        this.x += (p.noise(this.noffX) - 0.5) * speed;
        this.y += (p.noise(this.noffY) - 0.5) * speed;
        this.noffX += 0.008;
        this.noffY += 0.012;
        if (this.x < 0) this.x = p.width;
        if (this.x > p.width) this.x = 0;
        if (this.y < 0) this.y = p.height;
        if (this.y > p.height) this.y = 0;
      }
      draw() {
        p.fill(200, 200, 220, this.opa * 255);
        p.noStroke();
        p.circle(this.x, this.y, this.r * 2);
      }
    }

    function initParticles() {
      particles = [];
      const w = p.width || 800;
      const h = p.height || 500;
      const density = Math.max(120, Math.round((w * h) / 2000));
      for (let i = 0; i < density; i++) particles.push(new Particle());
    }

    function drawBlob(blob) {
      const e = blob.preset;
      const t = performance.now() * e.sp;
      const sf = 1 + Math.sin(t) * e.ba;
      const isHovered = blob.id === hoveredBlobId;
      const scale = isHovered ? 1.15 : 1;

      // Mouse interaction — blob gently leans toward the cursor
      const mx = p.mouseX, my = p.mouseY;
      const dm = p.dist(blob.x, blob.y, mx, my);
      const maxReach = blob.r * 4;
      let leanX = 0, leanY = 0, breathingBoost = 0;
      if (dm < maxReach && mx > 0 && my > 0) {
        const strength = 1 - dm / maxReach;
        const angle = Math.atan2(my - blob.y, mx - blob.x);
        leanX = Math.cos(angle) * strength * blob.r * 0.25;
        leanY = Math.sin(angle) * strength * blob.r * 0.25;
        breathingBoost = strength * 0.08;
      }

      p.push();
      p.translate(blob.x + leanX, blob.y + leanY);
      p.scale(scale);

      // Glow — stronger for hovered blob
      p.drawingContext.shadowBlur = isHovered ? 100 : 70;
      p.drawingContext.shadowColor = `hsla(${e.h}, ${e.s}%, ${e.l + 15}%, ${(isHovered ? 0.7 : 0.45) * blob.opacity})`;
      drawLayers(e, sf + breathingBoost, blob.opacity, blob.r * 1.04);

      // Main
      p.drawingContext.shadowBlur = 0;
      drawLayers(e, sf + breathingBoost, blob.opacity, blob.r);

      p.pop();

      if (blob.opacity < 1) blob.opacity = Math.min(1, blob.opacity + 0.04);
    }

    function drawLayers(e, sf, op, baseR) {
      p.colorMode(p.HSL, 360, 100, 100, 100);
      p.noStroke();
      for (let i = 0; i < 3; i++) {
        const t = i / 2;
        const r = baseR * (1 - t * 0.18);
        const la = (60 - t * 25) * op;
        const zs = i * 0.15;
        p.fill(e.h + t * 12, e.s + t * 10, e.l + t * 7, la);
        p.beginShape();
        for (let pt = 0; pt < 240; pt++) {
          const a = p.map(pt, 0, 240, 0, p.TWO_PI);
          const nv = p.noise(Math.cos(a) * 0.8 + 1 + zs, Math.sin(a) * 0.8 + 1 + zs, zoff + zs);
          p.vertex((r + nv * e.na) * sf * Math.cos(a), (r + nv * e.na) * sf * Math.sin(a));
        }
        p.endShape(p.CLOSE);
      }
    }

    /* ── Lifecycle ─────────────────────────────────────── */

    p.setup = () => {
      const w = container.clientWidth || 800;
      const h = Math.max(500, Math.min(700, w * 0.7));
      const cnv = p.createCanvas(w, h);
      cnv.parent(container);
      p.colorMode(p.RGB, 255);
      p.smooth();
      p.frameRate(30);
      initParticles();
    };

    p.draw = () => {
      // Layer 1: Black background + floating particles
      p.colorMode(p.RGB, 255);
      p.background(0, 0, 0);
      for (const pt of particles) {
        pt.update();
        pt.draw();
      }

      // Subtle particle connections (faint web)
      const connectDist = 80;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const d = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
          if (d < connectDist) {
            const a = (1 - d / connectDist) * 20;
            p.stroke(180, 180, 200, a);
            p.strokeWeight(0.5);
            p.line(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
          }
        }
      }
      p.noStroke();

      // Hover detection — find nearest blob under mouse
      hoveredBlobId = null;
      for (const blob of blobs) {
        if (blob.opacity < 0.02) continue;
        const d = p.dist(p.mouseX, p.mouseY, blob.x, blob.y);
        if (d < blob.r + 20) {
          hoveredBlobId = blob.id;
          break;
        }
      }
      // Cursor — pointer when hovering a blob
      if (hoveredBlobId) {
        document.querySelector('canvas')?.style.setProperty('cursor', 'pointer');
      } else {
        document.querySelector('canvas')?.style.setProperty('cursor', 'default');
      }

      // Layer 2: Houston blobs (HSL) — main focus
      let totalSp = 0, spCount = 0;
      for (const blob of blobs) {
        if (blob.opacity < 0.02) continue;
        drawBlob(blob);
        totalSp += blob.preset.sp;
        spCount++;
      }
      zoff += (spCount > 0 ? totalSp / spCount : 0.007) * 0.5;

      // Layer 3: Tooltip for hovered blob
      if (hoveredBlobId) {
        const blob = blobs.find(b => b.id === hoveredBlobId);
        if (blob && blob.playlistName) {
          p.push();
          p.colorMode(p.RGB, 255);
          const label = blob.playlistName;
          p.textFont('Helvetica Neue');
          p.textSize(13);
          p.textAlign(p.CENTER, p.CENTER);
          const tw = p.textWidth(label);
          const pad = 14;
          const bw = tw + pad * 2;
          const bh = 32;
          let tx = blob.x - bw / 2;
          let ty = blob.y - blob.r - 38;
          tx = Math.max(4, Math.min(p.width - bw - 4, tx));
          ty = Math.max(4, ty);
          p.fill(0, 0, 0, 200);
          p.noStroke();
          p.rect(tx, ty, bw, bh, 8);
          p.fill(255, 255, 255, 230);
          p.text(label, blob.x, ty + bh / 2);
          p.pop();
        }
      }
    };

    p.windowResized = () => {
      const w = container.clientWidth || p.windowWidth;
      const h = Math.max(500, Math.min(700, w * 0.7));
      p.resizeCanvas(w, h);
      initParticles();
    };

    /* ── Public API ── */

    p.setBg = () => {}; // no-op — background is always black

    p.setBlobs = (data) => {
      const existing = new Map(blobs.map(b => [b.id, b]));
      blobs = data.map(d => {
        const ex = existing.get(d.id);
        if (ex) {
          ex.x += (d.x - ex.x) * 0.08;
          ex.y += (d.y - ex.y) * 0.08;
          ex.r += ((d.r || 85) - ex.r) * 0.08;
          ex.preset = moodToColor(d.mood_tag);
          ex.playlistName = d.playlistName || ex.playlistName;
          return ex;
        }
        return { id: d.id, x: d.x, y: d.y, r: d.r || 85, preset: moodToColor(d.mood_tag), opacity: 0.05, playlistName: d.playlistName || '' };
      });
    };
  };

  return new P5(sketch);
}
