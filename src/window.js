/**
 * Window assigners + aggregation helpers.
 * TODO: implement correctly so tests pass.
 */

export class TumblingWindowAssigner {
  constructor({ sizeMs }) {
    this.sizeMs = sizeMs;
  }

  assign(_ts) {
    return [];
  }
}

export class SlidingWindowAssigner {
  constructor({ sizeMs, slideMs }) {
    this.sizeMs = sizeMs;
    this.slideMs = slideMs;
  }

  assign(_ts) {
    return [];
  }
}

export function aggregateRecords(_records) {
  return { count: 0, sum: 0, avg: 0 };
}
