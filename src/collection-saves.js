import {savedCheckpoint, checkpointLabel} from './autosave.js';

function refresh() {
  for (const link of document.querySelectorAll('[data-continue]')) {
    const game = link.dataset.continue;
    const checkpoint = savedCheckpoint(game);
    link.hidden = checkpoint === null;
    if (checkpoint === null) continue;
    const label = checkpointLabel(game, checkpoint);
    link.textContent = 'Continue · ' + label;
    link.setAttribute('aria-label', 'Continue ' + link.previousElementSibling.textContent + ' from ' + label);
  }
}

window.addEventListener('pageshow', refresh);
window.addEventListener('storage', refresh);
refresh();
