/**
 * Stream engine: event-time processing with watermark-driven window close.
 */
import { WatermarkTracker } from './watermark.js';
import { aggregateRecords } from './window.js';

export class StreamEngine {
  constructor({ assigner, allowedLatenessMs = 0 } = {}) {
    if (!assigner || typeof assigner.assign !== 'function') {
      throw new TypeError('assigner must implement assign(eventTimeMs)');
    }

    this.assigner = assigner;
    this.allowedLatenessMs = allowedLatenessMs;
    this.wm = new WatermarkTracker({ allowedLatenessMs });
    this.lateCount = 0;
    this.lateEvents = [];
    this.closedCount = 0;
    this.results = [];
    this._buffers = new Map(); // key|start|end -> window state
    this._closed = new Set();
    this._listeners = [];
  }

  onWindowClosed(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('onWindowClosed expects a function');
    }
    this._listeners.push(fn);
  }

  accept(event) {
    if (!event || typeof event !== 'object') {
      throw new TypeError('event must be an object');
    }
    if (!Number.isFinite(event.ts)) {
      throw new TypeError('event.ts must be a finite number');
    }

    const windows = this.assigner.assign(event.ts);
    const isWatermarkLate = event.ts < this.wm.current();
    const touchesClosedWindow = windows.some((window) =>
      this._closed.has(this._windowId(event.key, window)));

    if (isWatermarkLate || touchesClosedWindow) {
      this.lateCount += 1;
      this.lateEvents.push(event);
      return false;
    }

    for (const window of windows) {
      const id = this._windowId(event.key, window);
      if (!this._buffers.has(id)) {
        this._buffers.set(id, {
          key: event.key,
          start: window.start,
          end: window.end,
          records: [],
        });
      }
      this._buffers.get(id).records.push(event);
    }

    this.wm.observe(event.ts);
    this._closeDueWindows();
    return true;
  }

  flush() {
    this._closeDueWindows({ closeAll: true });
    return [...this.results];
  }

  _windowId(key, window) {
    return `${String(key)}\u0000${window.start}\u0000${window.end}`;
  }

  _closeDueWindows({ closeAll = false } = {}) {
    const watermark = this.wm.current();
    const due = [...this._buffers.values()]
      .filter((state) => closeAll || state.end <= watermark)
      .sort((a, b) => a.end - b.end || a.start - b.start || String(a.key).localeCompare(String(b.key)));

    for (const state of due) {
      const id = this._windowId(state.key, state);
      if (this._closed.has(id)) {
        continue;
      }

      const result = {
        key: state.key,
        start: state.start,
        end: state.end,
        ...aggregateRecords(state.records),
      };

      this._closed.add(id);
      this._buffers.delete(id);
      this.results.push(result);
      this.closedCount += 1;
      for (const listener of this._listeners) {
        listener(result);
      }
    }
  }
}
