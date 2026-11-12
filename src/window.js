/**
 * Window assigners and aggregation helpers.
 * Window intervals use the event-time convention [start, end).
 */

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive finite number`);
  }
}

export class TumblingWindowAssigner {
  constructor({ sizeMs }) {
    requirePositiveFinite(sizeMs, 'sizeMs');
    this.sizeMs = sizeMs;
  }

  assign(eventTimeMs) {
    if (!Number.isFinite(eventTimeMs)) {
      throw new TypeError('eventTimeMs must be a finite number');
    }

    const start = Math.floor(eventTimeMs / this.sizeMs) * this.sizeMs;
    return [{ start, end: start + this.sizeMs }];
  }
}

export class SlidingWindowAssigner {
  constructor({ sizeMs, slideMs }) {
    requirePositiveFinite(sizeMs, 'sizeMs');
    requirePositiveFinite(slideMs, 'slideMs');
    this.sizeMs = sizeMs;
    this.slideMs = slideMs;
  }

  assign(eventTimeMs) {
    if (!Number.isFinite(eventTimeMs)) {
      throw new TypeError('eventTimeMs must be a finite number');
    }

    const bucketStart = Math.floor(eventTimeMs / this.slideMs) * this.slideMs;
    const windows = [];

    if (this.sizeMs <= this.slideMs) {
      windows.push({ start: bucketStart, end: bucketStart + this.sizeMs });
      return windows;
    }

    const firstStart = bucketStart - this.sizeMs + this.slideMs;
    for (let start = firstStart; start < bucketStart; start += this.slideMs) {
      windows.push({ start, end: start + this.sizeMs });
    }

    return windows;
  }
}

export function aggregateRecords(records) {
  const count = records.length;
  const sum = records.reduce((total, record) => total + record.value, 0);
  return {
    count,
    sum,
    avg: count === 0 ? 0 : sum / count,
  };
}
