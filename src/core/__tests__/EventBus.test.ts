import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../EventBus';

describe('EventBus', () => {
  let bus: EventBus;
  beforeEach(() => {
    bus = new EventBus();
  });

  it('calls subscriber on emit', () => {
    const fn = vi.fn();
    bus.on('game:started', fn);
    bus.emit('game:started', undefined);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('passes payload to subscriber', () => {
    const fn = vi.fn();
    bus.on('game:tick', fn);
    bus.emit('game:tick', { tickNumber: 5, dt: 50 });
    expect(fn).toHaveBeenCalledWith({ tickNumber: 5, dt: 50 });
  });

  it('supports multiple subscribers', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on('game:started', fn1);
    bus.on('game:started', fn2);
    bus.emit('game:started', undefined);
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('once listener fires only once', () => {
    const fn = vi.fn();
    bus.once('game:paused', fn);
    bus.emit('game:paused', undefined);
    bus.emit('game:paused', undefined);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('off removes listener', () => {
    const fn = vi.fn();
    bus.on('game:started', fn);
    bus.off('game:started', fn);
    bus.emit('game:started', undefined);
    expect(fn).not.toHaveBeenCalled();
  });

  it('off does nothing for unregistered callback', () => {
    const fn = vi.fn();
    bus.off('game:started', fn);
    // Should not throw
  });

  it('clear removes all listeners', () => {
    const fn = vi.fn();
    bus.on('game:started', fn);
    bus.on('game:paused', fn);
    bus.clear();
    bus.emit('game:started', undefined);
    bus.emit('game:paused', undefined);
    expect(fn).not.toHaveBeenCalled();
  });

  it('emitting unsubscribed event does nothing', () => {
    // Should not throw
    bus.emit('game:started', undefined);
  });
});
