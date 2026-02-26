export interface CityPosition {
  x: number;  // Fractional [0, 1] position on map
  y: number;
}

export interface MapTemplate {
  id: string;
  name: string;
  description: string;
  elevationBias: (x: number, y: number, w: number, h: number, value: number) => number;
  moistureBias: (x: number, y: number, w: number, h: number, value: number) => number;
  cities: CityPosition[];
}

export const MAP_TEMPLATES: Record<string, MapTemplate> = {
  river_valley: {
    id: 'river_valley',
    name: 'River Valley',
    description: 'Central river divides map. 2-3 crossing points. Plains with forested hills behind.',
    elevationBias: (x, _y, w, _h, value) => {
      const centerDist = Math.abs(x / w - 0.5) * 2;
      const valleyFactor = 0.3 + 0.7 * centerDist;
      return value * valleyFactor;
    },
    moistureBias: (x, _y, w, _h, value) => {
      const centerDist = Math.abs(x / w - 0.5) * 2;
      return Math.min(1, value + (1 - centerDist) * 0.3);
    },
    cities: [
      { x: 0.25, y: 0.5 },
      { x: 0.75, y: 0.5 },
      { x: 0.50, y: 0.35 },
    ],
  },

  mountain_pass: {
    id: 'mountain_pass',
    name: 'Mountain Pass',
    description: 'Attacker in low plains, defender holds mountain pass. Narrow corridor through mountains.',
    elevationBias: (_x, y, _w, h, value) => {
      const normalY = y / h;
      if (normalY > 0.6) {
        return Math.min(1, value * 0.5 + 0.5);
      } else if (normalY < 0.4) {
        return value * 0.4;
      }
      return value * 0.6;
    },
    moistureBias: (_x, y, _w, h, value) => {
      const normalY = y / h;
      return normalY < 0.4 ? Math.min(1, value + 0.2) : value * 0.7;
    },
    cities: [
      { x: 0.50, y: 0.65 },
      { x: 0.50, y: 0.20 },
    ],
  },

  open_plains: {
    id: 'open_plains',
    name: 'Open Plains',
    description: 'Flat terrain with scattered forest patches and a stream. Cavalry warfare.',
    elevationBias: (_x, _y, _w, _h, value) => {
      return value * 0.4 + 0.25;
    },
    moistureBias: (_x, _y, _w, _h, value) => {
      return value;
    },
    cities: [
      { x: 0.15, y: 0.50 },
      { x: 0.85, y: 0.50 },
      { x: 0.50, y: 0.50 },
    ],
  },

  wetlands: {
    id: 'wetlands',
    name: 'Wetlands',
    description: 'Rivers, lakes, and marsh everywhere. Naval dominance wins. Limited dry land paths.',
    elevationBias: (_x, _y, _w, _h, value) => {
      return value * 0.35 + 0.10;
    },
    moistureBias: (_x, _y, _w, _h, value) => {
      return Math.min(1, value * 0.5 + 0.5);
    },
    cities: [
      { x: 0.20, y: 0.30 },
      { x: 0.80, y: 0.70 },
      { x: 0.50, y: 0.50 },
    ],
  },

  siege: {
    id: 'siege',
    name: 'Siege',
    description: 'Walled city in center with garrison. Attacker has numerical advantage on outskirts.',
    elevationBias: (x, y, w, h, value) => {
      const dx = x / w - 0.5;
      const dy = y / h - 0.5;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy) * 2;
      if (distFromCenter < 0.2) return 0.45;
      return value * 0.5 + 0.20;
    },
    moistureBias: (_x, _y, _w, _h, value) => {
      return value * 0.8;
    },
    cities: [
      { x: 0.50, y: 0.50 },
      { x: 0.15, y: 0.15 },
      { x: 0.85, y: 0.85 },
    ],
  },
};
