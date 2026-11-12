/**
 * Event-time watermark tracker.
 * TODO: implement correctly so tests pass.
 */
export class WatermarkTracker {
  constructor({ allowedLatenessMs = 0 } = {}) {
    this.allowedLatenessMs = allowedLatenessMs;
    this._maxEventTime = Number.NEGATIVE_INFINITY;
    this._wm = Number.NEGATIVE_INFINITY;
  }

  observe(_eventTimeMs) {
    // Intentionally incomplete skeleton
    return this._wm;
  }

  current() {
    return this._wm;
  }
}
