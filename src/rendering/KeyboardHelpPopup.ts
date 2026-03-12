/**
 * KeyboardHelpPopup — compact modal showing all hotkeys.
 * Triggered by '?' key. Dismisses on Escape or click-outside.
 */

const HOTKEY_SECTIONS = [
  {
    title: '战斗 Battle',
    keys: [
      ['Space', 'Pause / Resume'],
      ['1-4', 'Set speed (1x, 2x, 3x, 5x)'],
      ['Escape', 'Deselect / Retreat confirm'],
      ['Tab', 'Cycle unit selection'],
      ['Home', 'Center on general'],
    ],
  },
  {
    title: '命令 Orders',
    keys: [
      ['A', 'Attack'],
      ['H', 'Hold position'],
      ['R', 'Retreat'],
      ['F', 'Flank'],
      ['C', 'Charge'],
      ['G', 'Form up'],
      ['D', 'Disengage'],
      ['Y', 'Rally'],
    ],
  },
  {
    title: '界面 Interface',
    keys: [
      ['L', 'Toggle battle log'],
      ['T', 'Toggle AI chat'],
      ['F3', 'Performance monitor'],
      ['F12', 'Codex'],
      ['?', 'This help screen'],
      ['Ctrl+1-9', 'Assign control group'],
      ['5-9', 'Select control group'],
    ],
  },
];

export class KeyboardHelpPopup {
  private overlay: HTMLDivElement;
  private visible = false;
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleClick: (e: MouseEvent) => void;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.7);z-index:1100;
      display:none;justify-content:center;align-items:center;
      font-family:'Noto Serif SC',serif;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background:linear-gradient(135deg,#1A1A2E,#16213E);
      border:2px solid #C9A84C;border-radius:8px;
      padding:24px 32px;max-width:600px;width:90%;
      max-height:80vh;overflow-y:auto;
      box-shadow:0 8px 32px rgba(0,0,0,0.6);
    `;
    modal.setAttribute('data-modal', 'true');

    let html = `<h2 style="
      text-align:center;color:#C9A84C;font-size:20px;
      margin:0 0 16px;letter-spacing:4px;
    ">快捷键 Keyboard Shortcuts</h2>`;

    for (const section of HOTKEY_SECTIONS) {
      html += `<h3 style="
        color:#D4C4A0;font-size:14px;margin:12px 0 6px;
        border-bottom:1px solid rgba(201,168,76,0.3);
        padding-bottom:4px;letter-spacing:2px;
      ">${section.title}</h3>`;

      html += `<div style="display:grid;grid-template-columns:90px 1fr;gap:4px 12px;">`;
      for (const [key, desc] of section.keys) {
        html += `
          <div style="
            text-align:right;color:#C9A84C;font-size:13px;
            font-family:monospace;padding:2px 0;
          "><kbd style="
            background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);
            border-radius:3px;padding:1px 6px;font-size:12px;
          ">${key}</kbd></div>
          <div style="color:#D4C4A0;font-size:13px;padding:2px 0;">${desc}</div>`;
      }
      html += '</div>';
    }

    html += `<p style="
      text-align:center;color:#8B7D3C;font-size:11px;
      margin:16px 0 0;
    ">Press <kbd style="
      background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);
      border-radius:3px;padding:1px 4px;font-size:11px;color:#C9A84C;
    ">Esc</kbd> or click outside to close</p>`;

    modal.innerHTML = html;
    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);

    this.handleKeyDown = (e: KeyboardEvent) => {
      if (!this.visible) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      }
    };

    this.handleClick = (e: MouseEvent) => {
      if (!this.visible) return;
      const target = e.target as HTMLElement;
      if (!target.closest('[data-modal]')) {
        this.hide();
      }
    };

    window.addEventListener('keydown', this.handleKeyDown, true);
    this.overlay.addEventListener('mousedown', this.handleClick);
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    this.visible = true;
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.visible = false;
    this.overlay.style.display = 'none';
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown, true);
    this.overlay.remove();
  }
}
