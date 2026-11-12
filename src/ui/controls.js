/**
 * Browser controls and canvas visualization for the stream engine.
 */
import { StreamEngine } from '../engine.js';
import { SlidingWindowAssigner, TumblingWindowAssigner } from '../window.js';

const FIXTURE_URL = new URL('../../fixtures/events.jsonl', import.meta.url);

export function parseJsonl(text) {
  return text
    .split(/\r?\n/)
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return null;

      try {
        const event = JSON.parse(trimmed);
        if (!event || typeof event !== 'object') {
          throw new Error('event must be a JSON object');
        }
        if (event.key === undefined || event.key === null) {
          throw new Error('event.key is required');
        }
        if (!Number.isFinite(event.ts)) {
          throw new Error('event.ts must be a finite number');
        }
        if (!Number.isFinite(event.value)) {
          throw new Error('event.value must be a finite number');
        }
        return event;
      } catch (error) {
        throw new Error(`Invalid JSONL on line ${index + 1}: ${error.message}`);
      }
    })
    .filter(Boolean);
}

function element(id, fallback) {
  return fallback || document.getElementById(id) || document.querySelector(`#${id}`);
}

function readConfig(opts) {
  const sizeMs = Number(element('sizeMs', opts.sizeInput)?.value);
  const slideMs = Number(element('slideMs', opts.slideInput)?.value);
  const allowedLatenessMs = Number(element('latenessMs', opts.latenessInput)?.value);
  const assignerType = element('assigner', opts.assignerInput)?.value || 'tumbling';

  if (!Number.isFinite(sizeMs) || sizeMs <= 0) {
    throw new Error('Window size must be a positive number.');
  }
  if (!Number.isFinite(slideMs) || slideMs <= 0) {
    throw new Error('Sliding step must be a positive number.');
  }
  if (!Number.isFinite(allowedLatenessMs) || allowedLatenessMs < 0) {
    throw new Error('Allowed lateness must be a non-negative number.');
  }

  const assigner = assignerType === 'sliding'
    ? new SlidingWindowAssigner({ sizeMs, slideMs })
    : new TumblingWindowAssigner({ sizeMs });

  return { sizeMs, slideMs, allowedLatenessMs, assigner };
}

export function bindControls(opts = {}) {
  const statusEl = element('status', opts.statusEl);
  const canvas = element('viz', opts.canvas);
  const statsEl = element('stats', opts.statsEl);
  const lateEl = element('late-count', opts.lateEl);
  const resultsEl = element('results', opts.resultsEl);
  const inputEl = element('events-input', opts.inputEl);
  const loadBtn = element('btn-load', opts.loadBtn);
  const runBtn = element('btn-run', opts.runBtn);
  const exportBtn = element('btn-export', opts.exportBtn);

  let currentEvents = [];
  let currentResults = [];
  let currentEngine = null;

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function renderResults() {
    if (!resultsEl) return;
    resultsEl.replaceChildren();

    for (const result of currentResults) {
      const item = document.createElement('li');
      item.textContent = `${result.key} [${result.start}, ${result.end}) `
        + `count=${result.count}, sum=${result.sum}, avg=${result.avg.toFixed(2)}`;
      resultsEl.appendChild(item);
    }
  }

  function renderStats() {
    const watermark = currentEngine?.wm.current();
    const watermarkText = Number.isFinite(watermark) ? String(watermark) : '-';
    const lateCount = currentEngine?.lateCount ?? 0;

    if (statsEl) {
      statsEl.textContent = `watermark: ${watermarkText}\nclosed: ${currentResults.length}\nlate: ${lateCount}`;
    }
    if (lateEl) lateEl.textContent = String(lateCount);
  }

  function drawVisualization() {
    if (!canvas?.getContext) return;
    const ctx = canvas.getContext('2d');
    const dpr = globalThis.window?.devicePixelRatio || 1;
    const width = 720;
    const height = 420;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!currentEvents.length) {
      ctx.fillStyle = '#8aa0b8';
      ctx.font = '14px sans-serif';
      ctx.fillText('Load fixtures or paste JSONL, then press Run.', 24, 48);
      return;
    }

    const keys = [...new Set([
      ...currentEvents.map((event) => String(event.key)),
      ...currentResults.map((result) => String(result.key)),
    ])];
    const watermark = currentEngine?.wm.current();
    const timeValues = currentEvents.flatMap((event) => [event.ts]);
    for (const result of currentResults) timeValues.push(result.start, result.end);
    if (Number.isFinite(watermark)) timeValues.push(watermark);

    const minTime = Math.min(...timeValues);
    const maxTime = Math.max(...timeValues);
    const padding = Math.max((maxTime - minTime) * 0.08, 80);
    const left = 56;
    const right = width - 24;
    const top = 42;
    const laneHeight = Math.min(72, (height - top - 32) / keys.length);
    const x = (time) => left + ((time - minTime + padding) / (maxTime - minTime + padding * 2)) * (right - left);
    const y = (index) => top + index * laneHeight + laneHeight * 0.58;

    ctx.strokeStyle = '#2a3a4f';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const tickX = left + (i / 4) * (right - left);
      ctx.beginPath();
      ctx.moveTo(tickX, top - 12);
      ctx.lineTo(tickX, height - 34);
      ctx.stroke();
    }

    const lateEvents = new Set(currentEngine?.lateEvents ?? []);
    keys.forEach((key, laneIndex) => {
      const laneY = y(laneIndex);
      ctx.strokeStyle = '#34475f';
      ctx.beginPath();
      ctx.moveTo(left, laneY);
      ctx.lineTo(right, laneY);
      ctx.stroke();

      ctx.fillStyle = '#e7eef8';
      ctx.font = '12px sans-serif';
      ctx.fillText(key, 8, laneY + 4);

      for (const result of currentResults.filter((item) => String(item.key) === key)) {
        ctx.fillStyle = 'rgba(61, 156, 240, 0.22)';
        ctx.strokeStyle = '#3d9cf0';
        ctx.fillRect(x(result.start), laneY - 22, x(result.end) - x(result.start), 24);
        ctx.strokeRect(x(result.start), laneY - 22, x(result.end) - x(result.start), 24);
        ctx.fillStyle = '#b8d7f5';
        ctx.font = '10px monospace';
        ctx.fillText(`${result.count}/${result.sum}`, x(result.start) + 4, laneY - 7);
      }

      for (const event of currentEvents.filter((item) => String(item.key) === key)) {
        ctx.beginPath();
        ctx.arc(x(event.ts), laneY, 5, 0, Math.PI * 2);
        ctx.fillStyle = lateEvents.has(event) ? '#f06b6b' : '#58d68d';
        ctx.fill();
      }
    });

    if (Number.isFinite(watermark)) {
      const wmX = x(watermark);
      ctx.strokeStyle = '#f5c76b';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(wmX, top - 16);
      ctx.lineTo(wmX, height - 34);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f5c76b';
      ctx.font = '12px sans-serif';
      ctx.fillText(`WM ${watermark}`, Math.min(wmX + 6, right - 70), top - 18);
    }
  }

  function render() {
    renderStats();
    renderResults();
    drawVisualization();
  }

  function run() {
    try {
      if (!inputEl) throw new Error('Events input is missing.');
      const config = readConfig(opts);
      currentEvents = parseJsonl(inputEl.value || '');
      currentEngine = new StreamEngine({
        assigner: config.assigner,
        allowedLatenessMs: config.allowedLatenessMs,
      });
      for (const event of currentEvents) currentEngine.accept(event);
      currentResults = currentEngine.flush();
      render();
      setStatus('ready');
      return currentResults;
    } catch (error) {
      console.error(error);
      setStatus(`error: ${error.message || error}`);
      return [];
    }
  }

  async function loadFixtures() {
    try {
      const response = await fetch(opts.fixtureUrl || FIXTURE_URL.href);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (inputEl) inputEl.value = await response.text();
      setStatus('ready');
    } catch (error) {
      console.error(error);
      setStatus(`error: failed to load fixtures: ${error.message || error}`);
    }
  }

  function exportResults() {
    const payload = JSON.stringify(currentResults, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'event-window-results.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  loadBtn?.addEventListener('click', loadFixtures);
  runBtn?.addEventListener('click', run);
  exportBtn?.addEventListener('click', exportResults);
  render();

  return { run, loadFixtures, exportResults, parseJsonl };
}
