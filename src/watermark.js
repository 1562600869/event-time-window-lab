/**
 * Event-time watermark tracker.
 * A watermark means the tracker believes no event with an event time before
 * that point should arrive any more (apart from allowed late events).
 */
export class WatermarkTracker {
  constructor({ allowedLatenessMs = 0 } = {}) {
    if (!Number.isFinite(allowedLatenessMs) || allowedLatenessMs < 0) {
      throw new TypeError('allowedLatenessMs must be a non-negative finite number');
    }

    this.allowedLatenessMs = allowedLatenessMs;
    this._maxEventTime = Number.NEGATIVE_INFINITY;
    this._wm = Number.NEGATIVE_INFINITY;
  }

  observe(eventTimeMs) {
    if (!Number.isFinite(eventTimeMs)) {
      throw new TypeError('eventTimeMs must be a finite number');
    }

    this._maxEventTime = Math.max(this._maxEventTime, eventTimeMs);
    this._wm = this._maxEventTime - this.allowedLatenessMs;
    return this._wm;
  }

  current() {
    return this._wm;
  }
}
