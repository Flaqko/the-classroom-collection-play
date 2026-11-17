import {fullscreenDocument, toggleFullscreen, watchFullscreen} from './fullscreen.js';

const button = document.querySelector('#fullscreen');

if (fullscreenDocument.fullscreenEnabled && fullscreenDocument.documentElement.requestFullscreen) {
  button.hidden = false;
  watchFullscreen(button);
  button.addEventListener('click', async () => {
    try {
      await toggleFullscreen();
    } catch {
      document.querySelector('.game-status[aria-live], .game-status[role=status]').textContent = 'Fullscreen is unavailable in this window.';
    }
  });
}
