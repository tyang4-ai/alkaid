/**
 * Client for communicating with the backend agent API.
 */

import { TemplateCommentary } from './TemplateCommentary';

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

export interface ExplainDecisionContext {
  order_type: string;
  target_description: string;
  battle_context: {
    weather?: string;
    time_of_day?: string;
    own_casualties?: number;
    enemy_casualties?: number;
    morale?: string;
    supply?: number;
  };
  tendency_features?: number[];
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

  async chat(message: string, context?: object): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        context: context ?? undefined,
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

  /**
   * Request an AI decision explanation from the Sun Tzu agent.
   * Falls back to TemplateCommentary when the API is unavailable.
   */
  async explainDecision(context: ExplainDecisionContext): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/api/explain-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      return data.response;
    } catch {
      // Fallback to offline template commentary
      return TemplateCommentary.get({
        orderType: context.order_type,
        weather: context.battle_context?.weather,
        timeOfDay: context.battle_context?.time_of_day,
        morale: context.battle_context?.morale as 'high' | 'medium' | 'low' | undefined,
      });
    }
  }

  resetConversation(): void {
    this.conversationId = null;
  }
}
