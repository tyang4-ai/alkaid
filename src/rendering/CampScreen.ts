import { UnitType, UNIT_TYPE_CONFIGS, RECRUITMENT_COSTS } from '../constants';
import type { CampaignState } from '../simulation/campaign/CampaignTypes';
import type { RecruitmentManager } from '../simulation/campaign/RecruitmentManager';
import type { UnlockManager } from '../simulation/campaign/UnlockManager';

interface CampCallbacks {
  onReturnToMap?: () => void;
  onAdvanceTurn?: () => void;
  onRecruit?: (type: UnitType) => void;
  onReinforce?: (squadId: number) => void;
  onPromote?: (squadId: number) => void;
  onDismiss?: (squadId: number) => void;
  onRest?: () => void;
}

export class CampScreen {
  private overlay: HTMLDivElement;
  private callbacks: CampCallbacks = {};

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

  show(state: CampaignState, rm: RecruitmentManager, um: UnlockManager): void {
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => this.overlay.classList.remove('alkaid-hidden'));
    this.render(state, rm, um);
  }

  hide(): void {
    this.overlay.classList.add('alkaid-hidden');
    setTimeout(() => { this.overlay.style.display = 'none'; }, 200);
    this.overlay.innerHTML = '';
  }

  setCallbacks(cbs: CampCallbacks): void {
    this.callbacks = cbs;
  }

  destroy(): void {
    this.overlay.remove();
  }

  private render(state: CampaignState, rm: RecruitmentManager, um: UnlockManager): void {
    const unlockedTypes = um.getUnlockedUnitTypes();

    // Roster HTML
    const rosterHtml = state.roster.squads.map(s => {
      const config = UNIT_TYPE_CONFIGS[s.type];
      const hpPct = Math.round((s.size / s.maxSize) * 100);
      const expPct = s.experience;
      const statusBadge = s.trainingTurnsRemaining > 0
        ? `<span style="color:#AA6633;font-size:10px;">TRAINING ${s.trainingTurnsRemaining}t</span>`
        : s.isCaptured
          ? `<span style="color:#886633;font-size:10px;">CAPTURED ${Math.round(s.capturedEffectiveness * 100)}%</span>`
          : '';

      const canReinf = rm.canReinforce(s, state.resources).allowed;
      const canProm = rm.canPromote(s, state.resources, state.roster).allowed;

      return `
        <div style="
          display:flex;align-items:center;gap:8px;padding:6px 8px;
          background:rgba(28,20,16,0.6);border-radius:4px;border:1px solid #333;
        ">
          <div style="width:60px;">
            <div style="color:#C9A84C;font-size:12px;">${config.chineseName}</div>
            <div style="color:#8B7D3C;font-size:10px;">${config.displayName}</div>
          </div>
          <div style="flex:1;">
            <div style="display:flex;gap:4px;align-items:center;font-size:11px;color:#D4C4A0;">
              <span>${s.size}/${s.maxSize}</span>
              <div style="flex:1;height:4px;background:#333;border-radius:2px;">
                <div style="width:${hpPct}%;height:100%;background:#4A90D9;border-radius:2px;"></div>
              </div>
            </div>
            <div style="display:flex;gap:4px;align-items:center;font-size:11px;color:#8B7D3C;margin-top:2px;">
              <span>EXP ${expPct}</span>
              <div style="flex:1;height:3px;background:#333;border-radius:2px;">
                <div style="width:${expPct}%;height:100%;background:#6B8E5A;border-radius:2px;"></div>
              </div>
            </div>
            ${statusBadge}
          </div>
          <div style="display:flex;gap:4px;">
            ${canReinf ? `<button class="camp-reinforce-btn" data-id="${s.squadId}" style="
              padding:2px 6px;font-size:10px;background:#2A4A6A;color:#A0C4E0;
              border:1px solid #4A6A8A;border-radius:3px;cursor:pointer;">补</button>` : ''}
            ${canProm ? `<button class="camp-promote-btn" data-id="${s.squadId}" style="
              padding:2px 6px;font-size:10px;background:#6A5A2A;color:#D4C4A0;
              border:1px solid #8B7D3C;border-radius:3px;cursor:pointer;">升</button>` : ''}
            <button class="camp-dismiss-btn" data-id="${s.squadId}" style="
              padding:2px 6px;font-size:10px;background:#4A2A2A;color:#AA6666;
              border:1px solid #663333;border-radius:3px;cursor:pointer;">散</button>
          </div>
        </div>
      `;
    }).join('');

    // Recruit panel HTML
    const recruitableTypes = [
      UnitType.JI_HALBERDIERS, UnitType.DAO_SWORDSMEN, UnitType.NU_CROSSBOWMEN,
      UnitType.GONG_ARCHERS, UnitType.LIGHT_CAVALRY, UnitType.HEAVY_CAVALRY,
      UnitType.HORSE_ARCHERS, UnitType.SIEGE_ENGINEERS, UnitType.ELITE_GUARD, UnitType.SCOUTS,
    ];

    const recruitHtml = recruitableTypes.map(type => {
      const config = UNIT_TYPE_CONFIGS[type];
      const cost = RECRUITMENT_COSTS[type];
      if (!cost) return '';
      const check = rm.canRecruit(type, state.resources, state.roster, unlockedTypes);
      const locked = !unlockedTypes.includes(type);

      return `
        <div style="
          display:flex;align-items:center;gap:8px;padding:4px 8px;
          opacity:${locked ? '0.4' : (check.allowed ? '1' : '0.6')};
        ">
          <div style="width:80px;">
            <span style="color:#C9A84C;font-size:11px;">${config.chineseName}</span>
            <span style="color:#8B7D3C;font-size:10px;">${config.displayName}</span>
          </div>
          <div style="color:#AA9966;font-size:10px;flex:1;">
            ${cost.gold}g ${cost.population}p ${cost.horses > 0 ? cost.horses + 'h ' : ''}${cost.iron > 0 ? cost.iron + 'i ' : ''}${cost.trainingTurns}t
          </div>
          ${locked ? '<span style="color:#555;font-size:10px;">🔒</span>' :
            (check.allowed ? `<button class="camp-recruit-btn" data-type="${type}" style="
              padding:2px 8px;font-size:10px;background:#2A4A2A;color:#8BAA6B;
              border:1px solid #4A6A4A;border-radius:3px;cursor:pointer;">招</button>` :
              `<span style="color:#663333;font-size:10px;" title="${check.reason}">✗</span>`
            )}
        </div>
      `;
    }).join('');

    this.overlay.innerHTML = `
      <div style="
        display:flex;justify-content:space-between;align-items:center;
        padding:8px 16px;background:rgba(28,20,16,0.95);border-bottom:1px solid #8B7D3C;
      ">
        <div style="color:#C9A84C;font-size:16px;">營地 Camp · Turn ${state.turn}</div>
        <div style="display:flex;gap:16px;color:#D4C4A0;font-size:12px;">
          <span><span style="color:#C9A84C;">金</span> ${state.resources.gold}</span>
          <span><span style="color:#8BAA6B;">民</span> ${state.resources.population}</span>
          <span><span style="color:#B08050;">马</span> ${state.resources.horses}</span>
          <span><span style="color:#8899AA;">铁</span> ${state.resources.iron}</span>
          <span><span style="color:#AA8855;">粮</span> ${state.resources.food}</span>
        </div>
      </div>

      <div style="display:flex;flex:1;overflow:hidden;">
        <div style="flex:1;padding:12px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
          <div style="color:#C9A84C;font-size:13px;margin-bottom:4px;">
            Army Roster (${state.roster.squads.length} squads)
          </div>
          ${rosterHtml}
        </div>

        <div style="
          width:280px;background:rgba(28,20,16,0.95);border-left:1px solid #8B7D3C;
          padding:12px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;
        ">
          <div style="color:#C9A84C;font-size:13px;border-bottom:1px solid #4A3A2A;padding-bottom:6px;">
            Recruit 招募
          </div>
          ${recruitHtml}

          <div style="border-top:1px solid #4A3A2A;padding-top:8px;margin-top:8px;">
            <button id="camp-rest-btn" style="
              width:100%;padding:6px;font-size:12px;background:rgba(40,50,40,0.8);
              color:#8BAA6B;border:1px solid #4A6A4A;border-radius:4px;cursor:pointer;
            ">Rest Army 休整 (fatigue→0, morale→base)</button>
          </div>
        </div>
      </div>

      <div style="
        display:flex;justify-content:center;gap:16px;
        padding:10px;background:rgba(28,20,16,0.95);border-top:1px solid #8B7D3C;
      ">
        <button id="camp-return-btn" style="
          padding:8px 24px;border:1px solid #8B7D3C;border-radius:4px;
          background:rgba(60,40,30,0.8);color:#D4C4A0;cursor:pointer;font-size:13px;
        ">Return to Map 返回</button>
        <button id="camp-advance-btn" style="
          padding:8px 24px;border:1px solid #C9A84C;border-radius:4px;
          background:#6A5A2A;color:#D4C4A0;cursor:pointer;font-size:13px;
        ">Advance Turn 進入下月</button>
      </div>
    `;

    this.bindEvents(state, rm, um);
  }

  private bindEvents(state: CampaignState, rm: RecruitmentManager, um: UnlockManager): void {
    // Recruit buttons
    this.overlay.querySelectorAll<HTMLButtonElement>('.camp-recruit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = parseInt(btn.dataset.type!) as UnitType;
        this.callbacks.onRecruit?.(type);
        this.render(state, rm, um); // re-render to update resources
      });
    });

    // Reinforce buttons
    this.overlay.querySelectorAll<HTMLButtonElement>('.camp-reinforce-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id!);
        this.callbacks.onReinforce?.(id);
        this.render(state, rm, um);
      });
    });

    // Promote buttons
    this.overlay.querySelectorAll<HTMLButtonElement>('.camp-promote-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id!);
        this.callbacks.onPromote?.(id);
        this.render(state, rm, um);
      });
    });

    // Dismiss buttons
    this.overlay.querySelectorAll<HTMLButtonElement>('.camp-dismiss-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id!);
        this.callbacks.onDismiss?.(id);
        this.render(state, rm, um);
      });
    });

    // Rest button
    this.overlay.querySelector('#camp-rest-btn')?.addEventListener('click', () => {
      this.callbacks.onRest?.();
      this.render(state, rm, um);
    });

    // Return to map
    this.overlay.querySelector('#camp-return-btn')?.addEventListener('click', () => {
      this.callbacks.onReturnToMap?.();
    });

    // Advance turn
    this.overlay.querySelector('#camp-advance-btn')?.addEventListener('click', () => {
      this.callbacks.onAdvanceTurn?.();
      this.render(state, rm, um);
    });
  }
}
