const fullscreenRoot = document.documentElement;
const button = document.querySelector('#fullscreen');

if (document.fullscreenEnabled && fullscreenRoot.requestFullscreen) {
  button.hidden = false;

  document.addEventListener('fullscreenchange', () => {
    button.textContent = document.fullscreenElement === fullscreenRoot ? 'Exit fullscreen' : 'Fullscreen';
  });

  button.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === fullscreenRoot) await document.exitFullscreen();
      else await fullscreenRoot.requestFullscreen();
    } catch {
      document.querySelector('.game-status[aria-live], .game-status[role=status]').textContent = 'Fullscreen is unavailable in this window.';
    }
  });
}
