/**
 * Stream engine: event-time processing with watermark-driven window close.
 * TODO: implement correctly so tests pass.
 */
import { WatermarkTracker } from './watermark.js';
import { aggregateRecords } from './window.js';

export class StreamEngine {
  constructor({ assigner, allowedLatenessMs = 0 } = {}) {
    this.assigner = assigner;
    this.wm = new WatermarkTracker({ allowedLatenessMs });
    this.lateCount = 0;
    this._buffers = new Map(); // key|start|end -> records
    this._closed = new Set();
    this._listeners = [];
  }

  onWindowClosed(fn) {
    this._listeners.push(fn);
  }

  accept(_event) {
    // Intentionally incomplete
  }

  flush() {
    // Intentionally incomplete
  }
}
