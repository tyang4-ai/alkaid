/**
 * Dashboard header with title and branding.
 */

export class HeaderPanel {
  readonly element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 20px 24px; background: rgba(28, 20, 16, 0.92);
      border: 1px solid #8B7D3C; border-radius: 6px;
    `;

    const left = document.createElement('div');

    const title = document.createElement('h1');
    title.textContent = '破軍 Alkaid AI War Room';
    title.style.cssText = `
      font-size: 24px; color: #C9A84C; font-family: serif;
      letter-spacing: 3px; margin-bottom: 4px;
    `;
    left.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'RL Training Dashboard — Powered by DigitalOcean Gradient';
    subtitle.style.cssText = 'font-size: 12px; color: #8B7D3C; letter-spacing: 1px;';
    left.appendChild(subtitle);

    this.element.appendChild(left);

    const badge = document.createElement('div');
    badge.innerHTML = `<span style="color: #0069FF; font-size: 14px; font-weight: bold;">&#9679;</span>
      <span style="color: #D4C4A0; font-size: 12px; margin-left: 6px;">GPU Droplet RTX 4000</span>`;
    badge.style.cssText = `
      display: flex; align-items: center;
      background: rgba(0, 105, 255, 0.1); border: 1px solid rgba(0, 105, 255, 0.3);
      padding: 6px 14px; border-radius: 4px;
    `;
    this.element.appendChild(badge);
  }
}
