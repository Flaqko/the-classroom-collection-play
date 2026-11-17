export const fullscreenDocument = window.frameElement?.id === 'collection-player'
  ? window.parent.document
  : document;

export function toggleFullscreen() {
  return fullscreenDocument.fullscreenElement
    ? fullscreenDocument.exitFullscreen()
    : fullscreenDocument.documentElement.requestFullscreen();
}

export function watchFullscreen(button) {
  function update() {
    button.textContent = fullscreenDocument.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  }

  function listen() {
    fullscreenDocument.addEventListener('fullscreenchange', update);
    update();
  }

  listen();
  window.addEventListener('pagehide', () => fullscreenDocument.removeEventListener('fullscreenchange', update));
  window.addEventListener('pageshow', listen);
}
