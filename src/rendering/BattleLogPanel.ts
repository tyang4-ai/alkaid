/**
 * BattleLogPanel — toggle-able left sidebar showing battle events.
 * Ancient Chinese military scroll aesthetic with slide-in/out animation.
 * Listens to `battle:eventLogged` events from the EventBus.
 */

import { eventBus } from '../core/EventBus';

const PANEL_WIDTH = 280;
const MAX_EVENTS = 20;

const CATEGORY_COLORS: Record<string, string> = {
  combat:    '#8B0000',
  morale:    '#DAA520',
  supply:    '#556B2F',
  weather:   '#4682B4',
  surrender: '#FFD700',
};

const DEFAULT_CATEGORY_COLOR = '#8B7D3C';

interface LoggedEvent {
  tick: number;
  message: string;
  worldX?: number;
  worldY?: number;
  category: string;
}

export class BattleLogPanel {
  private panel: HTMLDivElement;
  private eventsContainer: HTMLDivElement;
  private events: LoggedEvent[] = [];
  private _visible = false;
  private styleEl: HTMLStyleElement;
  private boundOnEvent: (payload: LoggedEvent) => void;

  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    // Inject keyframes + panel-specific styles
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = `
      @keyframes battlelog-fadeIn {
        from { opacity: 0; transform: translateX(-12px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      .battlelog-event-row {
        animation: battlelog-fadeIn 0.3s ease-out both;
      }
      .battlelog-events::-webkit-scrollbar {
        width: 6px;
      }
      .battlelog-events::-webkit-scrollbar-track {
        background: rgba(10, 8, 6, 0.4);
      }
      .battlelog-events::-webkit-scrollbar-thumb {
        background: rgba(139, 125, 60, 0.5);
        border-radius: 3px;
      }
      .battlelog-events::-webkit-scrollbar-thumb:hover {
        background: rgba(201, 168, 76, 0.6);
      }
    `;
    document.head.appendChild(this.styleEl);

    // --- Main panel ---
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${PANEL_WIDTH}px;
      height: 100%;
      z-index: 500;
      pointer-events: auto;
      transform: translateX(-${PANEL_WIDTH}px);
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      background: rgba(10, 8, 6, 0.92);
      border-right: 3px solid #8B7D3C;
      box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
      font-family: serif;
      color: #D4C4A0;
    `;

    // Scroll-style top border decoration
    const topDecor = document.createElement('div');
    topDecor.style.cssText = `
      flex-shrink: 0;
      height: 8px;
      background: linear-gradient(180deg,
        #8B7D3C 0%, #5A4A3A 40%, rgba(10, 8, 6, 0.92) 100%);
      border-bottom: 1px solid #C9A84C;
    `;
    this.panel.appendChild(topDecor);

    // --- Header ---
    const header = document.createElement('div');
    header.style.cssText = `
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px 10px;
      border-bottom: 1px solid rgba(139, 125, 60, 0.6);
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 2px;
    `;
    const titleCn = document.createElement('span');
    titleCn.textContent = '战报';
    titleCn.style.cssText = `
      font-size: 18px;
      color: #C9A84C;
      letter-spacing: 4px;
      font-weight: bold;
    `;
    const titleEn = document.createElement('span');
    titleEn.textContent = 'Battle Log';
    titleEn.style.cssText = `
      font-size: 10px;
      color: rgba(212, 196, 160, 0.6);
      letter-spacing: 2px;
      text-transform: uppercase;
    `;
    title.appendChild(titleCn);
    title.appendChild(titleEn);
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = `
      background: none;
      border: 1px solid #5A4A3A;
      color: #D4C4A0;
      padding: 2px 8px;
      cursor: pointer;
      font-size: 14px;
      border-radius: 3px;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);
    this.panel.appendChild(header);

    // --- Events list ---
    this.eventsContainer = document.createElement('div');
    this.eventsContainer.className = 'battlelog-events';
    this.eventsContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      scroll-behavior: smooth;
    `;
    this.panel.appendChild(this.eventsContainer);

    // Empty state
    this.renderEmptyState();

    // Scroll-style bottom border decoration
    const bottomDecor = document.createElement('div');
    bottomDecor.style.cssText = `
      flex-shrink: 0;
      height: 8px;
      background: linear-gradient(0deg,
        #8B7D3C 0%, #5A4A3A 40%, rgba(10, 8, 6, 0.92) 100%);
      border-top: 1px solid #C9A84C;
    `;
    this.panel.appendChild(bottomDecor);

    this.container.appendChild(this.panel);

    // Subscribe to battle events
    this.boundOnEvent = (payload) => this.addEvent(payload);
    eventBus.on('battle:eventLogged', this.boundOnEvent);
  }

  private renderEmptyState(): void {
    const empty = document.createElement('div');
    empty.className = 'battlelog-empty';
    empty.style.cssText = `
      color: rgba(212, 196, 160, 0.35);
      font-size: 12px;
      text-align: center;
      padding: 30px 14px;
      font-style: italic;
      letter-spacing: 1px;
    `;
    empty.textContent = 'Awaiting battle reports...';
    this.eventsContainer.appendChild(empty);
  }

  private addEvent(evt: LoggedEvent): void {
    // Remove empty state on first event
    const emptyEl = this.eventsContainer.querySelector('.battlelog-empty');
    if (emptyEl) emptyEl.remove();

    this.events.push(evt);

    // Enforce max events
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
      const firstChild = this.eventsContainer.firstElementChild;
      if (firstChild) firstChild.remove();
    }

    // Create event row
    const row = document.createElement('div');
    row.className = 'battlelog-event-row';
    row.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 8px;
      border-bottom: 1px solid rgba(139, 125, 60, 0.15);
      font-size: 12px;
      line-height: 1.4;
    `;

    // Category dot
    const dot = document.createElement('span');
    const color = CATEGORY_COLORS[evt.category] ?? DEFAULT_CATEGORY_COLOR;
    dot.style.cssText = `
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${color};
      margin-top: 4px;
      box-shadow: 0 0 4px ${color};
    `;
    row.appendChild(dot);

    // Message + tick wrapper
    const textCol = document.createElement('div');
    textCol.style.cssText = `
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    `;

    const msgEl = document.createElement('span');
    msgEl.textContent = evt.message;
    msgEl.style.cssText = `
      color: #D4C4A0;
      word-wrap: break-word;
    `;
    textCol.appendChild(msgEl);

    const tickEl = document.createElement('span');
    tickEl.textContent = `Tick ${evt.tick}`;
    tickEl.style.cssText = `
      color: rgba(212, 196, 160, 0.4);
      font-size: 10px;
      font-family: monospace;
    `;
    textCol.appendChild(tickEl);

    row.appendChild(textCol);
    this.eventsContainer.appendChild(row);

    // Auto-scroll to bottom
    requestAnimationFrame(() => {
      this.eventsContainer.scrollTop = this.eventsContainer.scrollHeight;
    });
  }

  toggle(): void {
    if (this._visible) this.hide();
    else this.show();
  }

  show(): void {
    this._visible = true;
    this.panel.style.transform = 'translateX(0)';
  }

  hide(): void {
    this._visible = false;
    this.panel.style.transform = `translateX(-${PANEL_WIDTH}px)`;
  }

  clear(): void {
    this.events = [];
    this.eventsContainer.innerHTML = '';
    this.renderEmptyState();
  }

  destroy(): void {
    eventBus.off('battle:eventLogged', this.boundOnEvent);
    this.panel.remove();
    this.styleEl.remove();
  }
}
