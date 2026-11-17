if (window === window.top) {
  // Keep the fullscreen element mounted while the player moves between pages.
  const player = document.createElement('iframe');
  player.id = 'collection-player';
  player.title = 'The Classroom Collection';
  player.allowFullscreen = true;
  Object.assign(player.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    border: '0',
  });
  player.addEventListener('load', () => player.focus());
  player.src = window.location.href;
  document.body.replaceChildren(player);
} else {
  import('./collection-music.js?v=shared-fullscreen');
}
