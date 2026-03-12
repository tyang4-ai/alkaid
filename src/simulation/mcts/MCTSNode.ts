/**
 * MCTS tree node.
 * Each node holds a snapshot state, parent/child links,
 * visit statistics, and the action that led to this node.
 */

import type { LightweightSnapshot } from './LightweightSnapshot';

export class MCTSNode {
  snapshot: LightweightSnapshot;
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  totalValue: number;
  priorProbability: number;
  action: number[] | null; // The action that led to this node

  constructor(
    snapshot: LightweightSnapshot,
    parent: MCTSNode | null,
    action: number[] | null,
    prior: number,
  ) {
    this.snapshot = snapshot;
    this.parent = parent;
    this.children = [];
    this.visits = 0;
    this.totalValue = 0;
    this.priorProbability = prior;
    this.action = action;
  }

  get meanValue(): number {
    return this.visits > 0 ? this.totalValue / this.visits : 0;
  }

  /** UCB1 score for selection (with prior probability weighting a la PUCT). */
  ucb1(explorationConstant: number): number {
    if (this.visits === 0) return Infinity;
    const exploitation = this.meanValue;
    const parentVisits = this.parent ? this.parent.visits : 1;
    const exploration =
      explorationConstant *
      this.priorProbability *
      Math.sqrt(Math.log(parentVisits) / this.visits);
    return exploitation + exploration;
  }

  isLeaf(): boolean {
    return this.children.length === 0;
  }

  /** Return child with highest UCB1 score. */
  bestChild(explorationConstant: number): MCTSNode {
    let best: MCTSNode | null = null;
    let bestScore = -Infinity;

    for (const child of this.children) {
      const score = child.ucb1(explorationConstant);
      if (score > bestScore) {
        bestScore = score;
        best = child;
      }
    }

    return best!;
  }

  /** Return action of most-visited child (more robust than highest value). */
  bestAction(): number[] {
    let best: MCTSNode | null = null;
    let bestVisits = -1;

    for (const child of this.children) {
      if (child.visits > bestVisits) {
        bestVisits = child.visits;
        best = child;
      }
    }

    return best?.action ?? [];
  }
}
