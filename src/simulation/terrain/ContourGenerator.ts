import { CONTOUR } from '../../constants';

export interface ContourSegment {
  x1: number; y1: number;
  x2: number; y2: number;
  isMajor: boolean;
}

export class ContourGenerator {
  static generate(
    elevation: Float32Array, width: number, height: number,
  ): ContourSegment[] {
    const segments: ContourSegment[] = [];
    const { MINOR_INTERVAL, MAJOR_EVERY } = CONTOUR;

    const levels: { threshold: number; isMajor: boolean }[] = [];
    let levelIndex = 1;
    for (let t = MINOR_INTERVAL; t < 1.0; t += MINOR_INTERVAL) {
      levels.push({
        threshold: t,
        isMajor: levelIndex % MAJOR_EVERY === 0,
      });
      levelIndex++;
    }

    for (const level of levels) {
      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
          const tl = elevation[y * width + x];
          const tr = elevation[y * width + (x + 1)];
          const br = elevation[(y + 1) * width + (x + 1)];
          const bl = elevation[(y + 1) * width + x];

          const segs = this.marchSquare(
            x, y, tl, tr, br, bl, level.threshold, level.isMajor,
          );
          for (const s of segs) segments.push(s);
        }
      }
    }

    return segments;
  }

  private static marchSquare(
    x: number, y: number,
    tl: number, tr: number, br: number, bl: number,
    threshold: number, isMajor: boolean,
  ): ContourSegment[] {
    const caseIndex =
      (tl >= threshold ? 8 : 0) |
      (tr >= threshold ? 4 : 0) |
      (br >= threshold ? 2 : 0) |
      (bl >= threshold ? 1 : 0);

    if (caseIndex === 0 || caseIndex === 15) return [];

    const lerp = (a: number, b: number) => {
      if (Math.abs(b - a) < 1e-10) return 0.5;
      return (threshold - a) / (b - a);
    };

    const top = { x: x + lerp(tl, tr), y };
    const right = { x: x + 1, y: y + lerp(tr, br) };
    const bottom = { x: x + lerp(bl, br), y: y + 1 };
    const left = { x, y: y + lerp(tl, bl) };

    const seg = (a: { x: number; y: number }, b: { x: number; y: number }): ContourSegment => ({
      x1: a.x, y1: a.y, x2: b.x, y2: b.y, isMajor,
    });

    switch (caseIndex) {
      case 1:  return [seg(left, bottom)];
      case 2:  return [seg(bottom, right)];
      case 3:  return [seg(left, right)];
      case 4:  return [seg(top, right)];
      case 5:  return [seg(top, right), seg(left, bottom)];
      case 6:  return [seg(top, bottom)];
      case 7:  return [seg(top, left)];
      case 8:  return [seg(top, left)];
      case 9:  return [seg(top, bottom)];
      case 10: return [seg(top, right), seg(left, bottom)];
      case 11: return [seg(top, right)];
      case 12: return [seg(left, right)];
      case 13: return [seg(bottom, right)];
      case 14: return [seg(left, bottom)];
      default: return [];
    }
  }
}
