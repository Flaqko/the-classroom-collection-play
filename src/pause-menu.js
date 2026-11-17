export function setupPauseMenu({stage, canPause, clearInput, audio, backToTitle}) {
  const button = document.querySelector('#pause-game');
  stage.closest('.classroom-layout').append(button);
  const dialog = document.createElement('dialog');
  dialog.className = 'pause-menu';
  dialog.setAttribute('aria-labelledby', 'pause-heading');
  dialog.innerHTML = `
    <h2 id="pause-heading">Paused</h2>
    <button type="button" autofocus>Resume</button>
    <button type="button">Back to title</button>`;
  stage.parentElement.append(dialog);
  const [resumeButton, titleButton] = dialog.querySelectorAll('button');
  for (const utility of stage.parentElement.querySelectorAll('#fullscreen, #sound')) {
    dialog.append(utility);
  }

  function open() {
    if (dialog.open || !canPause()) return;
    clearInput();
    audio.pause();
    dialog.showModal();
  }

  function close() {
    if (!dialog.open) return;
    clearInput();
    dialog.close();
    if (!document.hidden) audio.resume();
  }

  function resume() {
    close();
    stage.focus({preventScroll: true});
  }

  function toggle() {
    if (dialog.open) resume();
    else open();
  }

  button.addEventListener('click', open);
  resumeButton.addEventListener('click', resume);
  titleButton.addEventListener('click', backToTitle);
  dialog.addEventListener('cancel', event => event.preventDefault());
  window.addEventListener('keydown', event => {
    const typing = event.target instanceof Element &&
      event.target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])');
    const pauseKey = event.key === 'Escape' ||
      (event.key.toLowerCase() === 'p' && !typing && !event.ctrlKey && !event.altKey && !event.metaKey);
    if (!pauseKey || (!dialog.open && !canPause())) return;
    event.preventDefault();
    if (event.repeat) return;
    toggle();
  });

  return {
    close,
    toggle,
    get paused() { return dialog.open; },
    refresh() { button.hidden = !canPause(); },
  };
}
