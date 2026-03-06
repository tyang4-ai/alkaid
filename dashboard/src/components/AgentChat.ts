/**
 * Full-width agent chat panel for the dashboard — talk to Sun Tzu about training.
 */

export class AgentChat {
  readonly element: HTMLDivElement;
  private messagesEl: HTMLDivElement;
  private inputEl: HTMLInputElement;
  private apiBase: string;
  private conversationId: string | null = null;
  private sending = false;

  constructor(apiBase: string) {
    this.apiBase = apiBase;

    this.element = document.createElement('div');
    this.element.style.cssText = `
      background: rgba(28, 20, 16, 0.92); border: 1px solid #8B7D3C;
      border-radius: 6px; padding: 20px; display: flex; flex-direction: column;
      max-height: 400px;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const title = document.createElement('div');
    title.textContent = '孫子兵法師 Sun Tzu Strategist';
    title.style.cssText = 'font-size: 16px; color: #C9A84C; font-family: serif; letter-spacing: 2px;';
    header.appendChild(title);

    const hint = document.createElement('div');
    hint.textContent = 'Ask about training progress, strategy, or model performance';
    hint.style.cssText = 'font-size: 11px; color: #8B7D3C;';
    header.appendChild(hint);

    this.element.appendChild(header);

    // Messages
    this.messagesEl = document.createElement('div');
    this.messagesEl.style.cssText = `
      flex: 1; overflow-y: auto; padding: 12px; min-height: 150px;
      background: rgba(10, 8, 6, 0.5); border-radius: 4px;
      display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px;
    `;
    this.addMessage('assistant',
      'Greetings, Commander. I am monitoring the training of your forces. '
      + 'Ask me about the model\'s progress, battle tactics, or strategic insights.');
    this.element.appendChild(this.messagesEl);

    // Input row
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display: flex; gap: 10px;';

    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.placeholder = 'Ask about training, tactics, or strategy...';
    this.inputEl.style.cssText = `
      flex: 1; background: rgba(10, 8, 6, 0.6); border: 1px solid #5A4A3A;
      color: #D4C4A0; padding: 10px 14px; font-size: 13px; font-family: monospace;
      border-radius: 4px; outline: none;
    `;
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSend();
    });
    inputRow.appendChild(this.inputEl);

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Send';
    sendBtn.style.cssText = `
      background: rgba(201, 168, 76, 0.2); border: 1px solid #8B7D3C;
      color: #C9A84C; padding: 10px 24px; cursor: pointer; font-size: 13px;
      border-radius: 4px; font-family: serif;
    `;
    sendBtn.addEventListener('click', () => this.handleSend());
    inputRow.appendChild(sendBtn);

    this.element.appendChild(inputRow);
  }

  private async handleSend(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text || this.sending) return;

    this.inputEl.value = '';
    this.addMessage('user', text);
    this.sending = true;

    try {
      const res = await fetch(`${this.apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversation_id: this.conversationId }),
      });

      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (data.conversation_id) this.conversationId = data.conversation_id;
      this.addMessage('assistant', data.response);
    } catch {
      this.addMessage('assistant', 'The messenger could not reach the war tent. Please try again.');
    } finally {
      this.sending = false;
    }
  }

  private addMessage(role: 'user' | 'assistant', content: string): void {
    const wrap = document.createElement('div');
    wrap.style.cssText = role === 'user'
      ? 'align-self: flex-end; max-width: 70%;'
      : 'align-self: flex-start; max-width: 80%;';

    const bubble = document.createElement('div');
    bubble.style.cssText = role === 'user'
      ? `background: rgba(70,100,160,0.3); border: 1px solid rgba(100,140,200,0.4);
         border-radius: 8px 8px 2px 8px; padding: 8px 14px; color: #B0C4DE; font-size: 13px;`
      : `background: rgba(201,168,76,0.1); border: 1px solid rgba(139,125,60,0.5);
         border-radius: 2px 8px 8px 8px; padding: 8px 14px; color: #D4C4A0; font-size: 13px; line-height: 1.5;`;
    bubble.textContent = content;
    wrap.appendChild(bubble);

    this.messagesEl.appendChild(wrap);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}
