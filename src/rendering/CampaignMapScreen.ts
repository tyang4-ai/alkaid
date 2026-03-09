import type { CampaignState } from '../simulation/campaign/CampaignTypes';
import type { TerritoryManager } from '../simulation/campaign/TerritoryManager';

interface MapCallbacks {
  onCamp?: () => void;
  onAttack?: (territoryId: string) => void;
  onTerritorySelected?: (territoryId: string) => void;
}

export class CampaignMapScreen {
  private overlay: HTMLDivElement;
  private callbacks: MapCallbacks = {};
  private selectedTerritoryId: string | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:rgba(10,8,6,0.95);z-index:500;
      display:none;flex-direction:column;
      pointer-events:auto;font-family:'Segoe UI',Arial,sans-serif;
    `;
    this.overlay.classList.add('alkaid-overlay', 'alkaid-hidden');
    document.body.appendChild(this.overlay);
  }

  show(state: CampaignState, territoryManager: TerritoryManager): void {
    this.selectedTerritoryId = null;
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => this.overlay.classList.remove('alkaid-hidden'));
    this.render(state, territoryManager);
  }

  hide(): void {
    this.overlay.classList.add('alkaid-hidden');
    setTimeout(() => { this.overlay.style.display = 'none'; }, 200);
    this.overlay.innerHTML = '';
  }

  update(state: CampaignState, territoryManager: TerritoryManager): void {
    if (this.overlay.style.display !== 'none') {
      this.render(state, territoryManager);
    }
  }

  setCallbacks(cbs: MapCallbacks): void {
    this.callbacks = cbs;
  }

  destroy(): void {
    this.overlay.remove();
  }

  private render(state: CampaignState, tm: TerritoryManager): void {
    const territories = tm.getAll();
    const attackable = tm.getAttackableFrom(tm.getPlayerTerritories().map(t => t.id));
    const attackableIds = new Set(attackable.map(t => t.id));

    const svgW = 600;
    const svgH = 450;

    // Build SVG adjacency lines
    const drawn = new Set<string>();
    let lines = '';
    for (const t of territories) {
      for (const adjId of t.adjacentIds) {
        const key = [t.id, adjId].sort().join('-');
        if (drawn.has(key)) continue;
        drawn.add(key);
        const adj = tm.get(adjId);
        if (!adj) continue;
        lines += `<line x1="${t.mapPosition.x * svgW}" y1="${t.mapPosition.y * svgH}"
          x2="${adj.mapPosition.x * svgW}" y2="${adj.mapPosition.y * svgH}"
          stroke="#4A3A2A" stroke-width="1.5" opacity="0.5"/>`;
      }
    }

    // Build SVG territory nodes
    let nodes = '';
    for (const t of territories) {
      const cx = t.mapPosition.x * svgW;
      const cy = t.mapPosition.y * svgH;
      const isPlayer = t.owner === 'player';
      const isAttackable = attackableIds.has(t.id);
      const fill = isPlayer ? '#4A90D9' : (isAttackable ? '#C75050' : '#555');
      const r = t.garrisonStrength > 15 ? 14 : (t.garrisonStrength > 10 ? 11 : 9);
      const stroke = isAttackable ? '#FF8844' : (isPlayer ? '#6BAAE8' : '#666');

      nodes += `
        <g class="map-territory" data-id="${t.id}" style="cursor:pointer;">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
          <text x="${cx}" y="${cy - r - 4}" text-anchor="middle" fill="#D4C4A0" font-size="10">${t.chineseName}</text>
        </g>
      `;
    }

    const sel = this.selectedTerritoryId ? tm.get(this.selectedTerritoryId) : null;
    const canAttack = sel && attackableIds.has(sel.id);

    this.overlay.innerHTML = `
      <div style="
        display:flex;justify-content:space-between;align-items:center;
        padding:8px 16px;background:rgba(28,20,16,0.95);border-bottom:1px solid #8B7D3C;
      ">
        <div style="display:flex;gap:20px;color:#D4C4A0;font-size:13px;">
          ${this.resourceHtml('金', state.resources.gold, '#C9A84C')}
          ${this.resourceHtml('民', state.resources.population, '#8BAA6B')}
          ${this.resourceHtml('马', state.resources.horses, '#B08050')}
          ${this.resourceHtml('铁', state.resources.iron, '#8899AA')}
          ${this.resourceHtml('粮', state.resources.food, '#AA8855')}
        </div>
        <div style="color:#8B7D3C;font-size:14px;">
          Turn ${state.turn} · ${state.territoriesConquered} territories
        </div>
      </div>

      <div style="display:flex;flex:1;overflow:hidden;">
        <div style="flex:1;display:flex;justify-content:center;align-items:center;padding:16px;">
          <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}"
               style="background:rgba(20,15,10,0.8);border:1px solid #4A3A2A;border-radius:4px;">
            ${lines}
            ${nodes}
          </svg>
        </div>

        <div style="
          width:240px;background:rgba(28,20,16,0.95);border-left:1px solid #8B7D3C;
          padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;
        ">
          <div style="color:#C9A84C;font-size:14px;border-bottom:1px solid #4A3A2A;padding-bottom:8px;">
            Army (${state.roster.squads.length} squads)
          </div>
          ${state.roster.squads.slice(0, 10).map(s => `
            <div style="font-size:12px;color:#D4C4A0;">
              <span style="color:#8B7D3C;">${this.unitTypeName(s.type)}</span>
              ${s.size}/${s.maxSize}
              ${s.trainingTurnsRemaining > 0 ? `<span style="color:#AA6633;"> (training ${s.trainingTurnsRemaining}t)</span>` : ''}
            </div>
          `).join('')}
          ${state.roster.squads.length > 10 ? `<div style="color:#8B7D3C;font-size:11px;">+${state.roster.squads.length - 10} more</div>` : ''}

          ${sel ? `
            <div style="border-top:1px solid #4A3A2A;padding-top:12px;margin-top:8px;">
              <div style="color:#C9A84C;font-size:16px;">${sel.chineseName} ${sel.name}</div>
              <div style="color:#8B7D3C;font-size:12px;margin-top:4px;">
                ${this.getTerritoryTypeLabel(sel.type)}<br>
                Garrison: ~${sel.garrisonStrength} squads<br>
                Owner: ${sel.owner}
              </div>
            </div>
          ` : `
            <div style="color:#555;font-size:12px;margin-top:8px;">
              Click a territory on the map
            </div>
          `}
        </div>
      </div>

      <div style="
        display:flex;justify-content:center;gap:16px;
        padding:12px;background:rgba(28,20,16,0.95);border-top:1px solid #8B7D3C;
      ">
        <button id="map-camp-btn" style="
          padding:8px 24px;border:1px solid #8B7D3C;border-radius:4px;
          background:rgba(60,40,30,0.8);color:#D4C4A0;cursor:pointer;font-size:14px;
        ">Camp 營地</button>
        <button id="map-attack-btn" style="
          padding:8px 24px;border:1px solid ${canAttack ? '#C75050' : '#555'};border-radius:4px;
          background:${canAttack ? '#8B2500' : 'rgba(60,40,30,0.3)'};
          color:${canAttack ? '#D4C4A0' : '#555'};
          cursor:${canAttack ? 'pointer' : 'not-allowed'};font-size:14px;
        " ${canAttack ? '' : 'disabled'}>Attack 進攻</button>
      </div>
    `;

    this.bindEvents(tm, attackableIds);
  }

  private bindEvents(_tm: TerritoryManager, attackableIds: Set<string>): void {
    // Territory clicks
    this.overlay.querySelectorAll<SVGGElement>('.map-territory').forEach(g => {
      g.addEventListener('click', () => {
        const id = g.dataset.id!;
        this.selectedTerritoryId = id;
        this.callbacks.onTerritorySelected?.(id);
        // Re-render with selection
        // We only re-render the side panel and attack button instead of full re-render
        // For simplicity, just trigger parent to call update()
      });
    });

    // Camp button
    this.overlay.querySelector('#map-camp-btn')?.addEventListener('click', () => {
      this.callbacks.onCamp?.();
    });

    // Attack button
    const attackBtn = this.overlay.querySelector<HTMLButtonElement>('#map-attack-btn');
    if (attackBtn && !attackBtn.disabled) {
      attackBtn.addEventListener('click', () => {
        if (this.selectedTerritoryId && attackableIds.has(this.selectedTerritoryId)) {
          this.callbacks.onAttack?.(this.selectedTerritoryId);
        }
      });
    }
  }

  private resourceHtml(label: string, value: number, color: string): string {
    return `<span><span style="color:${color};">${label}</span> ${value}</span>`;
  }

  private unitTypeName(type: number): string {
    const names: Record<number, string> = {
      0: '戟', 1: '刀', 2: '弩', 3: '弓', 4: '轻骑', 5: '重骑',
      6: '骑射', 7: '攻城', 8: '亲卫', 9: '斥候', 13: '将军',
    };
    return names[type] ?? '?';
  }

  private getTerritoryTypeLabel(type: number): string {
    const labels: Record<number, string> = {
      0: 'Farming Plains', 1: 'Trade City', 2: 'Horse Plains',
      3: 'Iron Mountains', 4: 'River Port', 5: 'Forest Region',
      6: 'Capital City', 7: 'Frontier Fort',
    };
    return labels[type] ?? 'Unknown';
  }
}
