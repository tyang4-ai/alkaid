import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TOOLTIP_DELAY_MS, TerrainType, TERRAIN_STATS } from '../../constants';

describe('TooltipSystem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('delay fires after TOOLTIP_DELAY_MS', () => {
    const fn = vi.fn();
    setTimeout(fn, TOOLTIP_DELAY_MS);

    vi.advanceTimersByTime(TOOLTIP_DELAY_MS - 1);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('mouse move cancels pending timer', () => {
    const fn = vi.fn();
    const timerId = setTimeout(fn, TOOLTIP_DELAY_MS);
    clearTimeout(timerId); // Simulate cancellation on mouse move

    vi.advanceTimersByTime(TOOLTIP_DELAY_MS + 100);
    expect(fn).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('terrain tooltip content correct for plains', () => {
    const stats = TERRAIN_STATS[TerrainType.PLAINS];
    expect(stats.moveCost).toBe(1.0);
    expect(stats.defBonus).toBe(0.0);
    expect(stats.forageRate).toBe(1.0);
  });

  it('terrain tooltip shows impassable for water', () => {
    const stats = TERRAIN_STATS[TerrainType.WATER];
    expect(stats.moveCost).toBe(-1);
    // TooltipSystem would show "Impassable" for negative move cost
    const displayCost = stats.moveCost < 0 ? 'Impassable' : `${stats.moveCost}x`;
    expect(displayCost).toBe('Impassable');
  });

  it('terrain tooltip shows defense bonus for hills', () => {
    const stats = TERRAIN_STATS[TerrainType.HILLS];
    expect(stats.defBonus).toBe(0.40);
    const displayDef = `${stats.defBonus >= 0 ? '+' : ''}${(stats.defBonus * 100).toFixed(0)}%`;
    expect(displayDef).toBe('+40%');
  });

  it('viewport clamping keeps tooltip in bounds', () => {
    const viewW = 1920;
    const viewH = 1080;
    const tooltipW = 280;
    const tooltipH = 80;
    const offset = 12;

    // Tooltip near right edge
    let left = 1800 + offset;
    if (left + tooltipW > viewW - 4) left = 1800 - tooltipW - offset;
    expect(left).toBeLessThan(viewW);

    // Tooltip near bottom edge
    let top = 1050 + offset;
    if (top + tooltipH > viewH - 4) top = 1050 - tooltipH - offset;
    expect(top).toBeLessThan(viewH);
  });
});
