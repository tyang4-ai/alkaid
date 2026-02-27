/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnitInfoPanel } from '../UnitInfoPanel';
import { UnitManager } from '../../simulation/units/UnitManager';
import { SelectionManager } from '../../simulation/SelectionManager';
import { UnitType, UnitState } from '../../constants';

describe('UnitInfoPanel', () => {
  let panel: UnitInfoPanel;
  let um: UnitManager;
  let sm: SelectionManager;
  let parentEl: HTMLDivElement;

  beforeEach(() => {
    parentEl = document.createElement('div');
    document.body.appendChild(parentEl);
    panel = new UnitInfoPanel(parentEl);
    um = new UnitManager();
    sm = new SelectionManager();
  });

  afterEach(() => {
    panel.destroy();
    document.body.removeChild(parentEl);
  });

  it('panel hidden when no selection', () => {
    panel.update(sm, um);
    expect(panel.isVisible).toBe(false);
  });

  it('panel shows detail view for single selected unit', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    sm.select(unit.id);
    panel.update(sm, um);

    expect(panel.isVisible).toBe(true);
    const html = parentEl.querySelector('.unit-info-panel')!.innerHTML;
    expect(html).toContain('Ji Halberdiers');
    expect(html).toContain('戟兵');
    expect(html).toContain('Strength');
    expect(html).toContain('Morale');
    expect(html).toContain('Fatigue');
  });

  it('panel shows summary view for multiple selected units', () => {
    const u1 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    const u2 = um.spawn({ type: UnitType.LIGHT_CAVALRY, team: 0, x: 200, y: 200 });
    sm.selectMultiple([u1.id, u2.id]);
    panel.update(sm, um);

    expect(panel.isVisible).toBe(true);
    const html = parentEl.querySelector('.unit-info-panel')!.innerHTML;
    expect(html).toContain('2 Units Selected');
    expect(html).toContain('Ji Halberdiers');
    expect(html).toContain('Light Cavalry');
  });

  it('clicking summary row switches to detail view', () => {
    const u1 = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    const u2 = um.spawn({ type: UnitType.LIGHT_CAVALRY, team: 0, x: 200, y: 200 });
    sm.selectMultiple([u1.id, u2.id]);
    panel.update(sm, um);

    // Click the first row
    const row = parentEl.querySelector(`[data-unit-id="${u1.id}"]`) as HTMLElement;
    expect(row).toBeTruthy();
    row.click();

    // Force re-render
    panel.update(sm, um);

    const html = parentEl.querySelector('.unit-info-panel')!.innerHTML;
    expect(html).toContain('Strength'); // Detail view shows stat bars
    expect(html).toContain('◀'); // Back button
  });

  it('strength bar shows correct values', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 60 });
    sm.select(unit.id);
    panel.update(sm, um);

    const html = parentEl.querySelector('.unit-info-panel')!.innerHTML;
    expect(html).toContain('60/120'); // 60 out of maxSize 120
  });

  it('panel updates when unit stats change', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, morale: 70 });
    sm.select(unit.id);
    panel.update(sm, um);

    const html1 = parentEl.querySelector('.unit-info-panel')!.innerHTML;
    expect(html1).toContain('70/100'); // morale

    // Change morale
    unit.morale = 50;
    panel.update(sm, um);

    const html2 = parentEl.querySelector('.unit-info-panel')!.innerHTML;
    expect(html2).toContain('50/100');
  });

  it('panel hides on deselect', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    sm.select(unit.id);
    panel.update(sm, um);
    expect(panel.isVisible).toBe(true);

    sm.deselectAll();
    panel.update(sm, um);
    expect(panel.isVisible).toBe(false);
  });

  it('shows correct unit type shape icons', () => {
    const infantry = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    sm.select(infantry.id);
    panel.update(sm, um);

    let html = parentEl.querySelector('.unit-info-panel')!.innerHTML;
    expect(html).toContain('●'); // Circle for infantry

    const cav = um.spawn({ type: UnitType.LIGHT_CAVALRY, team: 0, x: 200, y: 200 });
    sm.select(cav.id);
    panel.update(sm, um);

    html = parentEl.querySelector('.unit-info-panel')!.innerHTML;
    expect(html).toContain('▲'); // Triangle for cavalry
  });
});
