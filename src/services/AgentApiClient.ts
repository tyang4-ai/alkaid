/**
 * Client for communicating with the backend agent API.
 */

const DEFAULT_BASE_URL = 'http://localhost:8000';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatResponse {
  response: string;
  source: string;
  conversation_id?: string;
}

export interface SimulationResult {
  iterations: number;
  winrates: Record<string, number>;
  avg_ticks: number;
  avg_casualties: Record<string, number>;
  victory_types: Record<string, number>;
}

export class AgentApiClient {
  private baseUrl: string;
  private conversationId: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? DEFAULT_BASE_URL;
  }

  async chat(message: string): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation_id: this.conversationId,
      }),
    });
    if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
    const data: ChatResponse = await res.json();
    if (data.conversation_id) this.conversationId = data.conversation_id;
    return data;
  }

  async analyzeBattle(replayData: object): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replay_data: replayData }),
    });
    if (!res.ok) throw new Error(`Analyze failed: ${res.status}`);
    return res.json();
  }

  async suggestArmy(terrain: string, enemy: string[], budget: number): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/suggest-army`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terrain, enemy_composition: enemy, budget }),
    });
    if (!res.ok) throw new Error(`Suggest failed: ${res.status}`);
    return res.json();
  }

  async simulate(
    army1: string[], army2: string[], terrain: string, iterations: number,
  ): Promise<SimulationResult> {
    const res = await fetch(`${this.baseUrl}/api/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ army1, army2, terrain, iterations }),
    });
    if (!res.ok) throw new Error(`Simulate failed: ${res.status}`);
    return res.json();
  }

  resetConversation(): void {
    this.conversationId = null;
  }
}
