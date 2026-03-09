/**
 * generate-sprites.ts
 * Generates 16x16 placeholder sprite PNGs for units, terrain, and UI icons.
 * Run with: npx tsx scripts/generate-sprites.ts
 */

import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const SPRITES = join(ROOT, 'public', 'assets', 'sprites');
const SIZE = 16;

// Ensure output dirs exist
for (const sub of ['units', 'terrain', 'ui']) {
  mkdirSync(join(SPRITES, sub), { recursive: true });
}

function savePng(subPath: string, canvas: ReturnType<typeof createCanvas>): void {
  const fullPath = join(SPRITES, subPath);
  const buffer = canvas.toBuffer('image/png');
  writeFileSync(fullPath, buffer);
  console.log(`  ${subPath}`);
}

function freshCanvas(): [ReturnType<typeof createCanvas>, SKRSContext2D] {
  const c = createCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);
  return [c, ctx];
}

// ─── UNIT SPRITES ────────────────────────────────────────────────────────────

const UNIT_GREY = '#CCCCCC';

function drawUnitSprite(name: string, drawFn: (ctx: SKRSContext2D) => void): void {
  const [c, ctx] = freshCanvas();
  ctx.fillStyle = UNIT_GREY;
  ctx.strokeStyle = UNIT_GREY;
  ctx.lineWidth = 1;
  drawFn(ctx);
  savePng(`units/${name}.png`, c);
}

// ji_halberdiers — upward triangle
drawUnitSprite('ji_halberdiers', (ctx) => {
  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.lineTo(14, 13);
  ctx.lineTo(2, 13);
  ctx.closePath();
  ctx.fill();
});

// dao_swordsmen — square (shield)
drawUnitSprite('dao_swordsmen', (ctx) => {
  ctx.fillRect(3, 3, 10, 10);
});

// nu_crossbowmen — cross/plus shape
drawUnitSprite('nu_crossbowmen', (ctx) => {
  ctx.fillRect(6, 2, 4, 12);
  ctx.fillRect(2, 6, 12, 4);
});

// gong_archers — diamond
drawUnitSprite('gong_archers', (ctx) => {
  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.lineTo(14, 8);
  ctx.lineTo(8, 14);
  ctx.lineTo(2, 8);
  ctx.closePath();
  ctx.fill();
});

// light_cavalry — right-pointing triangle
drawUnitSprite('light_cavalry', (ctx) => {
  ctx.beginPath();
  ctx.moveTo(3, 3);
  ctx.lineTo(13, 8);
  ctx.lineTo(3, 13);
  ctx.closePath();
  ctx.fill();
});

// heavy_cavalry — thick right-pointing chevron
drawUnitSprite('heavy_cavalry', (ctx) => {
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(3, 3);
  ctx.lineTo(12, 8);
  ctx.lineTo(3, 13);
  ctx.stroke();
  // fill inner area for thickness
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(3, 3);
  ctx.lineTo(12, 8);
  ctx.lineTo(3, 13);
  ctx.lineTo(6, 8);
  ctx.closePath();
  ctx.fill();
});

// horse_archers — right-pointing triangle with line (arrow)
drawUnitSprite('horse_archers', (ctx) => {
  ctx.beginPath();
  ctx.moveTo(4, 4);
  ctx.lineTo(12, 8);
  ctx.lineTo(4, 12);
  ctx.closePath();
  ctx.fill();
  // arrow line
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(1, 8);
  ctx.lineTo(14, 8);
  ctx.stroke();
});

// siege_engineers — large square/rectangle
drawUnitSprite('siege_engineers', (ctx) => {
  ctx.fillRect(2, 4, 12, 8);
  // inner detail
  ctx.clearRect(4, 6, 8, 4);
  ctx.fillRect(5, 7, 6, 2);
});

// elite_guard — 5-point star
drawUnitSprite('elite_guard', (ctx) => {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const innerAngle = ((i + 0.5) * 2 * Math.PI) / 5 - Math.PI / 2;
    const ox = 8 + 6 * Math.cos(outerAngle);
    const oy = 8 + 6 * Math.sin(outerAngle);
    const ix = 8 + 2.5 * Math.cos(innerAngle);
    const iy = 8 + 2.5 * Math.sin(innerAngle);
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
});

// scouts — small circle
drawUnitSprite('scouts', (ctx) => {
  ctx.beginPath();
  ctx.arc(8, 8, 4, 0, Math.PI * 2);
  ctx.fill();
});

// meng_chong — hexagon
drawUnitSprite('meng_chong', (ctx) => {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 6;
    const x = 8 + 6 * Math.cos(angle);
    const y = 8 + 6 * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
});

// lou_chuan — wide hexagon
drawUnitSprite('lou_chuan', (ctx) => {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const rx = i % 3 === 0 ? 7 : 5;
    const ry = 6;
    const x = 8 + rx * Math.cos(angle);
    const y = 8 + ry * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
});

// fire_ships — hexagon with dot
drawUnitSprite('fire_ships', (ctx) => {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 6;
    const x = 8 + 5 * Math.cos(angle);
    const y = 8 + 5 * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // center dot (darker)
  ctx.fillStyle = '#999999';
  ctx.beginPath();
  ctx.arc(8, 8, 2, 0, Math.PI * 2);
  ctx.fill();
});

// general — circle with cross inside
drawUnitSprite('general', (ctx) => {
  ctx.beginPath();
  ctx.arc(8, 8, 6, 0, Math.PI * 2);
  ctx.fill();
  // cross cutout
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(8, 3);
  ctx.lineTo(8, 13);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(3, 8);
  ctx.lineTo(13, 8);
  ctx.stroke();
});

// ─── TERRAIN SPRITES ─────────────────────────────────────────────────────────

// Simple seeded PRNG for deterministic noise
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

interface TerrainDef {
  name: string;
  baseColor: string;
  pattern: (ctx: SKRSContext2D, variant: number, rng: () => number, rgb: [number, number, number]) => void;
}

const terrainDefs: TerrainDef[] = [
  {
    name: 'plains',
    baseColor: '#C4B07B',
    pattern: (ctx, _v, rng, rgb) => {
      // slight grain variation
      const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = Math.floor((rng() - 0.5) * 20);
        d[i] = Math.min(255, Math.max(0, rgb[0] + noise));
        d[i + 1] = Math.min(255, Math.max(0, rgb[1] + noise));
        d[i + 2] = Math.min(255, Math.max(0, rgb[2] + noise));
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    },
  },
  {
    name: 'forest',
    baseColor: '#5B7A47',
    pattern: (ctx, _v, rng, rgb) => {
      // fill base with noise
      const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = Math.floor((rng() - 0.5) * 15);
        d[i] = Math.min(255, Math.max(0, rgb[0] + noise));
        d[i + 1] = Math.min(255, Math.max(0, rgb[1] + noise));
        d[i + 2] = Math.min(255, Math.max(0, rgb[2] + noise));
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      // tree dots
      ctx.fillStyle = '#3D5A2E';
      for (let t = 0; t < 5; t++) {
        const tx = Math.floor(rng() * 14) + 1;
        const ty = Math.floor(rng() * 14) + 1;
        ctx.beginPath();
        ctx.arc(tx, ty, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    name: 'hills',
    baseColor: '#9E8C6C',
    pattern: (ctx, _v, rng, rgb) => {
      // base fill with noise
      const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = Math.floor((rng() - 0.5) * 18);
        d[i] = Math.min(255, Math.max(0, rgb[0] + noise));
        d[i + 1] = Math.min(255, Math.max(0, rgb[1] + noise));
        d[i + 2] = Math.min(255, Math.max(0, rgb[2] + noise));
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      // diagonal hatching
      ctx.strokeStyle = '#7A6A52';
      ctx.lineWidth = 0.8;
      for (let i = -SIZE; i < SIZE * 2; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + SIZE, SIZE);
        ctx.stroke();
      }
    },
  },
  {
    name: 'mountains',
    baseColor: '#6B5B4F',
    pattern: (ctx, _v, rng, rgb) => {
      // base
      const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = Math.floor((rng() - 0.5) * 15);
        d[i] = Math.min(255, Math.max(0, rgb[0] + noise));
        d[i + 1] = Math.min(255, Math.max(0, rgb[1] + noise));
        d[i + 2] = Math.min(255, Math.max(0, rgb[2] + noise));
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      // peak patterns (triangles)
      ctx.fillStyle = '#4A3F37';
      ctx.beginPath();
      ctx.moveTo(4, 12);
      ctx.lineTo(8, 3);
      ctx.lineTo(12, 12);
      ctx.closePath();
      ctx.fill();
      // snow cap
      ctx.fillStyle = '#9E9080';
      ctx.beginPath();
      ctx.moveTo(6, 7);
      ctx.lineTo(8, 3);
      ctx.lineTo(10, 7);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    name: 'water',
    baseColor: '#3A5A7A',
    pattern: (ctx, _v, rng, rgb) => {
      // base
      const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = Math.floor((rng() - 0.5) * 12);
        d[i] = Math.min(255, Math.max(0, rgb[0] + noise));
        d[i + 1] = Math.min(255, Math.max(0, rgb[1] + noise));
        d[i + 2] = Math.min(255, Math.max(0, rgb[2] + noise));
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      // wave lines
      ctx.strokeStyle = '#5A7A9A';
      ctx.lineWidth = 0.8;
      for (let row = 3; row < SIZE; row += 5) {
        ctx.beginPath();
        for (let x = 0; x < SIZE; x++) {
          const y = row + Math.sin((x + rng() * 2) * 0.8) * 1.5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
  },
  {
    name: 'ford',
    baseColor: '#7A9BB5',
    pattern: (ctx, _v, rng, rgb) => {
      // base
      const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = Math.floor((rng() - 0.5) * 15);
        d[i] = Math.min(255, Math.max(0, rgb[0] + noise));
        d[i + 1] = Math.min(255, Math.max(0, rgb[1] + noise));
        d[i + 2] = Math.min(255, Math.max(0, rgb[2] + noise));
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      // dots (shallow water stones)
      ctx.fillStyle = '#9AB5C5';
      for (let t = 0; t < 6; t++) {
        const tx = Math.floor(rng() * 12) + 2;
        const ty = Math.floor(rng() * 12) + 2;
        ctx.fillRect(tx, ty, 2, 2);
      }
    },
  },
  {
    name: 'river',
    baseColor: '#4A6B8A',
    pattern: (ctx, _v, rng, rgb) => {
      // base
      const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = Math.floor((rng() - 0.5) * 12);
        d[i] = Math.min(255, Math.max(0, rgb[0] + noise));
        d[i + 1] = Math.min(255, Math.max(0, rgb[1] + noise));
        d[i + 2] = Math.min(255, Math.max(0, rgb[2] + noise));
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      // flow lines (vertical-ish)
      ctx.strokeStyle = '#6A8BAA';
      ctx.lineWidth = 0.7;
      for (let col = 3; col < SIZE; col += 4) {
        ctx.beginPath();
        for (let y = 0; y < SIZE; y++) {
          const x = col + Math.sin(y * 0.6 + rng()) * 1.5;
          if (y === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
  },
  {
    name: 'marsh',
    baseColor: '#6B7B5A',
    pattern: (ctx, _v, rng, rgb) => {
      // base
      const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = Math.floor((rng() - 0.5) * 20);
        d[i] = Math.min(255, Math.max(0, rgb[0] + noise));
        d[i + 1] = Math.min(255, Math.max(0, rgb[1] + noise));
        d[i + 2] = Math.min(255, Math.max(0, rgb[2] + noise));
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      // murky dots
      ctx.fillStyle = '#4A5B3A';
      for (let t = 0; t < 8; t++) {
        const tx = Math.floor(rng() * 14) + 1;
        const ty = Math.floor(rng() * 14) + 1;
        ctx.fillRect(tx, ty, 1, 1);
      }
      // reed lines
      ctx.strokeStyle = '#8B9B6A';
      ctx.lineWidth = 0.5;
      for (let r = 0; r < 3; r++) {
        const rx = Math.floor(rng() * 12) + 2;
        const ry = Math.floor(rng() * 6) + 8;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + (rng() - 0.5) * 3, ry - 5);
        ctx.stroke();
      }
    },
  },
  {
    name: 'road',
    baseColor: '#A89070',
    pattern: (ctx, _v, rng, rgb) => {
      // base
      const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = Math.floor((rng() - 0.5) * 15);
        d[i] = Math.min(255, Math.max(0, rgb[0] + noise));
        d[i + 1] = Math.min(255, Math.max(0, rgb[1] + noise));
        d[i + 2] = Math.min(255, Math.max(0, rgb[2] + noise));
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      // track lines (horizontal ruts)
      ctx.strokeStyle = '#8A7050';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(16, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(16, 10);
      ctx.stroke();
    },
  },
  {
    name: 'city',
    baseColor: '#8B7355',
    pattern: (ctx, _v, rng, rgb) => {
      // base
      const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = Math.floor((rng() - 0.5) * 12);
        d[i] = Math.min(255, Math.max(0, rgb[0] + noise));
        d[i + 1] = Math.min(255, Math.max(0, rgb[1] + noise));
        d[i + 2] = Math.min(255, Math.max(0, rgb[2] + noise));
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      // grid pattern (buildings)
      ctx.strokeStyle = '#6B5340';
      ctx.lineWidth = 0.6;
      for (let x = 3; x < SIZE; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, 1);
        ctx.lineTo(x, 15);
        ctx.stroke();
      }
      for (let y = 3; y < SIZE; y += 4) {
        ctx.beginPath();
        ctx.moveTo(1, y);
        ctx.lineTo(15, y);
        ctx.stroke();
      }
    },
  },
];

console.log('\nGenerating terrain sprites...');
for (const tDef of terrainDefs) {
  for (let v = 0; v < 4; v++) {
    const [c, ctx] = freshCanvas();
    const rgb = hexToRgb(tDef.baseColor);
    const rng = seededRandom(tDef.name.length * 1000 + v * 137);
    // fill base
    ctx.fillStyle = tDef.baseColor;
    ctx.fillRect(0, 0, SIZE, SIZE);
    tDef.pattern(ctx, v, rng, rgb);
    savePng(`terrain/${tDef.name}_${v}.png`, c);
  }
}

// ─── UI ICONS ────────────────────────────────────────────────────────────────

console.log('\nGenerating UI icons...');

function drawUiIcon(name: string, drawFn: (ctx: SKRSContext2D) => void): void {
  const [c, ctx] = freshCanvas();
  drawFn(ctx);
  savePng(`ui/${name}.png`, c);
}

// morale — heart (red)
drawUiIcon('morale', (ctx) => {
  ctx.fillStyle = '#CC3333';
  ctx.beginPath();
  // heart shape using arcs + triangle
  ctx.moveTo(8, 14);
  ctx.bezierCurveTo(1, 9, 1, 3, 5, 3);
  ctx.bezierCurveTo(7, 3, 8, 5, 8, 5);
  ctx.bezierCurveTo(8, 5, 9, 3, 11, 3);
  ctx.bezierCurveTo(15, 3, 15, 9, 8, 14);
  ctx.closePath();
  ctx.fill();
});

// supply — grain/wheat (yellow)
drawUiIcon('supply', (ctx) => {
  ctx.strokeStyle = '#CCAA33';
  ctx.fillStyle = '#CCAA33';
  ctx.lineWidth = 1.2;
  // stem
  ctx.beginPath();
  ctx.moveTo(8, 14);
  ctx.lineTo(8, 4);
  ctx.stroke();
  // grain kernels (ovals along stem)
  for (let i = 0; i < 4; i++) {
    const y = 4 + i * 2;
    ctx.beginPath();
    ctx.ellipse(6, y, 1.5, 1, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, y, 1.5, 1, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
});

// fatigue — zig-zag line (orange)
drawUiIcon('fatigue', (ctx) => {
  ctx.strokeStyle = '#CC8833';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, 8);
  ctx.lineTo(5, 4);
  ctx.lineTo(8, 12);
  ctx.lineTo(11, 4);
  ctx.lineTo(14, 8);
  ctx.stroke();
});

// weather_clear — sun circle (yellow)
drawUiIcon('weather_clear', (ctx) => {
  ctx.fillStyle = '#DDBB33';
  ctx.strokeStyle = '#DDBB33';
  ctx.lineWidth = 1.2;
  // circle
  ctx.beginPath();
  ctx.arc(8, 8, 4, 0, Math.PI * 2);
  ctx.fill();
  // rays
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(8 + 5 * Math.cos(angle), 8 + 5 * Math.sin(angle));
    ctx.lineTo(8 + 7 * Math.cos(angle), 8 + 7 * Math.sin(angle));
    ctx.stroke();
  }
});

// weather_rain — cloud with drops (blue)
drawUiIcon('weather_rain', (ctx) => {
  // cloud
  ctx.fillStyle = '#7799BB';
  ctx.beginPath();
  ctx.arc(6, 5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(10, 5, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(3, 5, 10, 3);
  // rain drops
  ctx.fillStyle = '#4477AA';
  ctx.fillRect(4, 10, 1, 2);
  ctx.fillRect(7, 11, 1, 2);
  ctx.fillRect(10, 10, 1, 2);
  ctx.fillRect(6, 13, 1, 2);
  ctx.fillRect(9, 13, 1, 2);
});

// weather_fog — wavy lines (grey)
drawUiIcon('weather_fog', (ctx) => {
  ctx.strokeStyle = '#AAAAAA';
  ctx.lineWidth = 1.5;
  for (let row = 4; row <= 12; row += 4) {
    ctx.beginPath();
    for (let x = 0; x < SIZE; x++) {
      const y = row + Math.sin(x * 0.7 + row) * 1.5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
});

// weather_wind — swoosh lines (white)
drawUiIcon('weather_wind', (ctx) => {
  ctx.strokeStyle = '#DDDDDD';
  ctx.lineWidth = 1.3;
  // three swoosh lines
  ctx.beginPath();
  ctx.moveTo(2, 5);
  ctx.quadraticCurveTo(10, 3, 14, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1, 8);
  ctx.quadraticCurveTo(8, 6, 13, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(3, 11);
  ctx.quadraticCurveTo(9, 9, 15, 11);
  ctx.stroke();
});

// weather_snow — snowflake (white)
drawUiIcon('weather_snow', (ctx) => {
  ctx.strokeStyle = '#DDDDDD';
  ctx.lineWidth = 1.2;
  // 6 arms of snowflake
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const ex = 8 + 6 * Math.cos(angle);
    const ey = 8 + 6 * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // small branches
    const mx = 8 + 3.5 * Math.cos(angle);
    const my = 8 + 3.5 * Math.sin(angle);
    const branchAngle1 = angle + Math.PI / 4;
    const branchAngle2 = angle - Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + 2 * Math.cos(branchAngle1), my + 2 * Math.sin(branchAngle1));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + 2 * Math.cos(branchAngle2), my + 2 * Math.sin(branchAngle2));
    ctx.stroke();
  }
});

// experience — star (gold)
drawUiIcon('experience', (ctx) => {
  ctx.fillStyle = '#DDAA22';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const innerAngle = ((i + 0.5) * 2 * Math.PI) / 5 - Math.PI / 2;
    const ox = 8 + 7 * Math.cos(outerAngle);
    const oy = 8 + 7 * Math.sin(outerAngle);
    const ix = 8 + 3 * Math.cos(innerAngle);
    const iy = 8 + 3 * Math.sin(innerAngle);
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
});

// arrow — right-pointing arrow (white)
drawUiIcon('arrow', (ctx) => {
  ctx.fillStyle = '#DDDDDD';
  ctx.strokeStyle = '#DDDDDD';
  ctx.lineWidth = 2;
  // shaft
  ctx.beginPath();
  ctx.moveTo(2, 8);
  ctx.lineTo(10, 8);
  ctx.stroke();
  // arrowhead
  ctx.beginPath();
  ctx.moveTo(10, 4);
  ctx.lineTo(14, 8);
  ctx.lineTo(10, 12);
  ctx.closePath();
  ctx.fill();
});

console.log('\nDone! Generated all placeholder sprites.');
