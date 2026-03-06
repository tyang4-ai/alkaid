/**
 * Sun Tzu Strategist Agent chat panel — right sidebar overlay.
 * Uses native DOM (same pattern as Codex.ts and BattleHUD.ts).
 */

import { AgentApiClient, type ChatMessage } from '../services/AgentApiClient';
import type { BattleContext } from '../simulation/ai/BattleAnalyzer';

const PANEL_WIDTH = 340;

const QUICK_ACTIONS = [
  { label: '分析 Analyze', prompt: 'Analyze the current battle situation.' },
  { label: '何策 Advise', prompt: 'What should I do next, strategically?' },
  { label: '薦軍 Suggest', prompt: 'Suggest an army composition for this terrain.' },
] as const;

export type ContextProvider = () => BattleContext | null;

export class AgentChatPanel {
  private panel: HTMLDivElement;
  private messagesEl: HTMLDivElement;
  private inputEl: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private client: AgentApiClient;
  private messages: ChatMessage[] = [];
  private _visible = false;
  private _sending = false;
  private contextProvider: ContextProvider | null = null;

  constructor(parentElement: HTMLElement, apiBaseUrl?: string) {
    this.client = new AgentApiClient(apiBaseUrl);

    // --- Main panel container ---
    this.panel = document.createElement('div');
    this.panel.className = 'agent-chat-panel';
    this.panel.style.cssText = `
      position: absolute; top: 0; right: 0; width: ${PANEL_WIDTH}px; height: 100%;
      background: rgba(28, 20, 16, 0.94); border-left: 2px solid #8B7D3C;
      display: none; flex-direction: column; z-index: 750;
      font-family: monospace; font-size: 13px; color: #D4C4A0;
      pointer-events: auto;
    `;

    // --- Header ---
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 14px; border-bottom: 1px solid #8B7D3C; flex-shrink: 0;
    `;

    const title = document.createElement('span');
    title.textContent = '孫子兵法師 Sun Tzu';
    title.style.cssText = `
      font-size: 15px; color: #C9A84C; font-family: serif;
      letter-spacing: 2px;
    `;
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none; border: 1px solid #5A4A3A; color: #D4C4A0;
      padding: 2px 8px; cursor: pointer; font-size: 14px; border-radius: 3px;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);
    this.panel.appendChild(header);

    // --- Quick action buttons ---
    const quickBar = document.createElement('div');
    quickBar.style.cssText = `
      display: flex; gap: 6px; padding: 8px 14px;
      border-bottom: 1px solid rgba(139, 125, 60, 0.4); flex-shrink: 0;
    `;
    for (const action of QUICK_ACTIONS) {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      btn.style.cssText = `
        background: rgba(201, 168, 76, 0.12); border: 1px solid #8B7D3C;
        color: #C9A84C; padding: 4px 10px; cursor: pointer; font-size: 11px;
        border-radius: 3px; font-family: serif; letter-spacing: 1px;
        flex: 1;
      `;
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(201, 168, 76, 0.25)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(201, 168, 76, 0.12)'; });
      btn.addEventListener('click', () => this.sendMessage(action.prompt));
      quickBar.appendChild(btn);
    }
    this.panel.appendChild(quickBar);

    // --- Messages area ---
    this.messagesEl = document.createElement('div');
    this.messagesEl.style.cssText = `
      flex: 1; overflow-y: auto; padding: 12px 14px;
      display: flex; flex-direction: column; gap: 10px;
    `;
    this.panel.appendChild(this.messagesEl);

    // Welcome message
    this.addAssistantMessage(
      'Greetings, Commander (將軍). I am your strategist, guided by the Art of War (孫子兵法). '
      + 'Ask me to analyze battles, suggest formations, or discuss tactics. '
      + '"Know the enemy and know yourself; in a hundred battles you will never be defeated." — Sun Tzu',
    );

    // --- Input area ---
    const inputArea = document.createElement('div');
    inputArea.style.cssText = `
      display: flex; gap: 8px; padding: 10px 14px;
      border-top: 1px solid #8B7D3C; flex-shrink: 0;
    `;

    this.inputEl = document.createElement('textarea');
    this.inputEl.placeholder = 'Ask your strategist...';
    this.inputEl.rows = 2;
    this.inputEl.style.cssText = `
      flex: 1; background: rgba(10, 8, 6, 0.6); border: 1px solid #5A4A3A;
      color: #D4C4A0; padding: 8px; font-size: 12px; font-family: monospace;
      border-radius: 3px; resize: none; outline: none;
    `;
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        this.handleSend();
      }
    });
    inputArea.appendChild(this.inputEl);

    this.sendBtn = document.createElement('button');
    this.sendBtn.textContent = '發';
    this.sendBtn.title = 'Send';
    this.sendBtn.style.cssText = `
      background: rgba(201, 168, 76, 0.2); border: 1px solid #8B7D3C;
      color: #C9A84C; padding: 0 14px; cursor: pointer; font-size: 16px;
      border-radius: 3px; font-family: serif; align-self: stretch;
    `;
    this.sendBtn.addEventListener('click', () => this.handleSend());
    inputArea.appendChild(this.sendBtn);

    this.panel.appendChild(inputArea);
    parentElement.appendChild(this.panel);
  }

  get visible(): boolean {
    return this._visible;
  }

  show(): void {
    this._visible = true;
    this.panel.style.display = 'flex';
    this.inputEl.focus();
  }

  hide(): void {
    this._visible = false;
    this.panel.style.display = 'none';
  }

  toggle(): void {
    if (this._visible) this.hide();
    else this.show();
  }

  setContextProvider(provider: ContextProvider): void {
    this.contextProvider = provider;
  }

  private handleSend(): void {
    const text = this.inputEl.value.trim();
    if (!text || this._sending) return;
    this.inputEl.value = '';
    this.sendMessage(text);
  }

  private async sendMessage(text: string): Promise<void> {
    if (this._sending) return;

    this.addUserMessage(text);
    this._sending = true;
    this.sendBtn.style.opacity = '0.5';

    // Show typing indicator
    const typingEl = this.addTypingIndicator();

    try {
      const ctx = this.contextProvider?.() ?? undefined;
      const response = await this.client.chat(text, ctx);
      typingEl.remove();
      this.addAssistantMessage(response.response);
    } catch {
      typingEl.remove();
      this.addAssistantMessage('My apologies, Commander — the messenger could not reach the war tent. Please try again.');
    } finally {
      this._sending = false;
      this.sendBtn.style.opacity = '1';
    }
  }

  private addUserMessage(content: string): void {
    const msg: ChatMessage = { role: 'user', content, timestamp: Date.now() };
    this.messages.push(msg);

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      align-self: flex-end; max-width: 85%;
      background: rgba(70, 100, 160, 0.3); border: 1px solid rgba(100, 140, 200, 0.4);
      border-radius: 8px 8px 2px 8px; padding: 8px 12px;
      color: #B0C4DE; font-size: 12px; word-wrap: break-word;
    `;
    bubble.textContent = content;
    this.messagesEl.appendChild(bubble);
    this.scrollToBottom();
  }

  private addAssistantMessage(content: string): void {
    const msg: ChatMessage = { role: 'assistant', content, timestamp: Date.now() };
    this.messages.push(msg);

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'align-self: flex-start; max-width: 90%; display: flex; gap: 8px;';

    // Avatar
    const avatar = document.createElement('div');
    avatar.textContent = '孫';
    avatar.style.cssText = `
      width: 28px; height: 28px; border-radius: 50%;
      background: rgba(201, 168, 76, 0.2); border: 1px solid #C9A84C;
      color: #C9A84C; font-family: serif; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    `;
    wrapper.appendChild(avatar);

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      background: rgba(201, 168, 76, 0.1); border: 1px solid rgba(139, 125, 60, 0.5);
      border-radius: 2px 8px 8px 8px; padding: 8px 12px;
      color: #D4C4A0; font-size: 12px; word-wrap: break-word; line-height: 1.5;
    `;

    // Typewriter effect
    this.typewriterEffect(bubble, content);

    wrapper.appendChild(bubble);
    this.messagesEl.appendChild(wrapper);
    this.scrollToBottom();
  }

  private typewriterEffect(el: HTMLElement, text: string): void {
    let index = 0;
    const chunkSize = 3;
    const interval = setInterval(() => {
      const next = Math.min(index + chunkSize, text.length);
      el.textContent = text.slice(0, next);
      index = next;
      this.scrollToBottom();
      if (index >= text.length) clearInterval(interval);
    }, 20);
  }

  private addTypingIndicator(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = `
      align-self: flex-start; padding: 8px 16px;
      color: #8B7D3C; font-style: italic; font-size: 11px;
    `;
    el.textContent = 'Sun Tzu is contemplating...';
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
    return el;
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  destroy(): void {
    this.panel.remove();
  }
}
