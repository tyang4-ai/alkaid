import { UNIT_TYPE_CONFIGS } from '../constants';
import type { Territory, CampaignSquad } from '../simulation/campaign/CampaignTypes';
import type { EnemySquadDef } from '../simulation/campaign/EnemyArmyGenerator';

interface IntelCallbacks {
  onDeploy?: () => void;
  onCancel?: () => void;
}

export class IntelScreen {
  private overlay: HTMLDivElement;
  private callbacks: IntelCallbacks = {};

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:rgba(10,8,6,0.85);z-index:600;
      display:none;justify-content:center;align-items:center;
      pointer-events:auto;font-family:'Segoe UI',Arial,sans-serif;
    `;
    document.body.appendChild(this.overlay);
  }

  show(territory: Territory, readySquads: CampaignSquad[], enemyPreview?: EnemySquadDef[]): void {
    this.overlay.style.display = 'flex';
    this.render(territory, readySquads, enemyPreview);
  }

  hide(): void {
    this.overlay.style.display = 'none';
    this.overlay.innerHTML = '';
  }

  setCallbacks(cbs: IntelCallbacks): void {
    this.callbacks = cbs;
  }

  destroy(): void {
    this.overlay.remove();
  }

  private render(territory: Territory, readySquads: CampaignSquad[], enemyPreview?: EnemySquadDef[]): void {
    const totalPlayerTroops = readySquads.reduce((sum, s) => sum + s.size, 0);

    const terrainLabel: Record<number, string> = {
      0: 'Farming Plains 农田', 1: 'Trade City 商城', 2: 'Horse Plains 马场',
      3: 'Iron Mountains 铁山', 4: 'River Port 河港', 5: 'Forest Region 林区',
      6: 'Capital City 帝都', 7: 'Frontier Fort 边关',
    };

    const playerSquadHtml = readySquads.map(s => {
      const config = UNIT_TYPE_CONFIGS[s.type];
      return `<div style="font-size:11px;color:#D4C4A0;padding:2px 0;">
        <span style="color:#4A90D9;">${config.chineseName}</span> ${s.size}/${s.maxSize} exp:${s.experience}
      </div>`;
    }).join('');

    let enemyHtml = `<div style="color:#555;font-size:12px;">~${territory.garrisonStrength} squads (est.)</div>`;
    if (enemyPreview) {
      const totalEnemy = enemyPreview.reduce((sum, s) => sum + s.size, 0);
      enemyHtml = enemyPreview.map(s => {
        const config = UNIT_TYPE_CONFIGS[s.type];
        return `<div style="font-size:11px;color:#D4C4A0;padding:2px 0;">
          <span style="color:#C75050;">${config?.chineseName ?? '?'}</span> ${s.size} exp:${s.experience}
          ${s.isGeneral ? '<span style="color:#C9A84C;">★</span>' : ''}
        </div>`;
      }).join('');
      enemyHtml += `<div style="color:#8B7D3C;font-size:11px;margin-top:4px;">Total: ${totalEnemy}</div>`;
    }

    this.overlay.innerHTML = `
      <div style="
        background:rgba(28,20,16,0.97);border:2px solid #8B7D3C;border-radius:8px;
        padding:24px 32px;max-width:600px;width:90%;display:flex;flex-direction:column;gap:16px;
      ">
        <div style="text-align:center;">
          <div style="font-size:24px;color:#C9A84C;">${territory.chineseName}</div>
          <div style="font-size:14px;color:#D4C4A0;">${territory.name}</div>
          <div style="font-size:12px;color:#8B7D3C;margin-top:4px;">${terrainLabel[territory.type] ?? 'Unknown'}</div>
        </div>

        <div style="display:flex;gap:24px;">
          <div style="flex:1;">
            <div style="color:#4A90D9;font-size:13px;border-bottom:1px solid #333;padding-bottom:4px;margin-bottom:6px;">
              Your Army (${readySquads.length} squads, ${totalPlayerTroops} troops)
            </div>
            ${playerSquadHtml}
          </div>
          <div style="flex:1;">
            <div style="color:#C75050;font-size:13px;border-bottom:1px solid #333;padding-bottom:4px;margin-bottom:6px;">
              Enemy Garrison
            </div>
            ${enemyHtml}
          </div>
        </div>

        <div style="display:flex;justify-content:center;gap:16px;margin-top:8px;">
          <button id="intel-cancel-btn" style="
            padding:8px 24px;border:1px solid #555;border-radius:4px;
            background:rgba(60,40,30,0.6);color:#8B7D3C;cursor:pointer;font-size:14px;
          ">Cancel 取消</button>
          <button id="intel-deploy-btn" style="
            padding:8px 24px;border:1px solid #8B7D3C;border-radius:4px;
            background:#8B2500;color:#D4C4A0;cursor:pointer;font-size:14px;
          ">Deploy 部署</button>
        </div>
      </div>
    `;

    this.overlay.querySelector('#intel-cancel-btn')?.addEventListener('click', () => {
      this.callbacks.onCancel?.();
    });
    this.overlay.querySelector('#intel-deploy-btn')?.addEventListener('click', () => {
      this.callbacks.onDeploy?.();
    });
  }
}
