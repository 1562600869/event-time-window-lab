import { bindControls } from './ui/controls.js';

const statusEl = document.querySelector('#status');

try {
  bindControls({
    statusEl,
    canvas: document.querySelector('#viz'),
    statsEl: document.querySelector('#stats'),
    lateEl: document.querySelector('#late-count'),
    resultsEl: document.querySelector('#results'),
    inputEl: document.querySelector('#events-input'),
  });
  if (statusEl) statusEl.textContent = 'ready';
} catch (err) {
  if (statusEl) statusEl.textContent = `error: ${err.message || err}`;
  console.error(err);
}
