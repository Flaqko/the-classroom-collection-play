const games = {
  classic: {count: 10, unit: 'Day'},
  sequel: {count: 13, unit: 'Classroom'},
  third: {count: 11, unit: 'Act'},
};

const keyFor = game => 'classroom.autosave.v1.' + game;

export function savedCheckpoint(game) {
  try {
    const value = Number(localStorage.getItem(keyFor(game)));
    return Number.isInteger(value) && value >= 1 && value <= games[game]?.count ? value : null;
  } catch {
    return null;
  }
}

export function checkpointLabel(game, checkpoint) {
  return games[game].unit + ' ' + checkpoint;
}

export function setupAutosave(game, resume, onAvailability) {
  const menuButtons = [...document.querySelectorAll('[data-resume-menu]')];
  let sessionCheckpoint = null;

  function current() {
    return savedCheckpoint(game) ?? sessionCheckpoint;
  }

  function refresh() {
    const checkpoint = current();
    for (const menuButton of menuButtons) {
      menuButton.hidden = checkpoint === null;
      const tooltip = menuButton.querySelector('[role=tooltip]');
      const label = checkpoint === null ? '' : 'Continue from ' + checkpointLabel(game, checkpoint);
      if (tooltip) tooltip.textContent = checkpoint === null ? '' : checkpointLabel(game, checkpoint);
      else menuButton.title = label;
    }
    onAvailability?.(checkpoint !== null, checkpoint);
  }

  function continueGame() {
    const checkpoint = current();
    if (checkpoint === null) return false;
    return resume(checkpoint) !== false;
  }

  for (const menuButton of menuButtons) menuButton.addEventListener('click', continueGame);
  window.addEventListener('storage', event => {
    if (event.key === keyFor(game) || event.key === null) {
      sessionCheckpoint = null;
      refresh();
    }
  });
  window.addEventListener('pageshow', refresh);
  refresh();

  return {
    continueGame,
    save(checkpoint) {
      if (!Number.isInteger(checkpoint) || checkpoint < 1 || checkpoint > games[game].count) return;
      if (savedCheckpoint(game) !== checkpoint) {
        try {
          localStorage.setItem(keyFor(game), String(checkpoint));
        } catch {
          // Continue remains available for this page when browser storage is blocked.
        }
      }
      sessionCheckpoint = checkpoint;
      refresh();
    },
    resumeFromLink() {
      const url = new URL(location.href);
      if (url.searchParams.get('continue') !== '1') return false;
      url.searchParams.delete('continue');
      history.replaceState(history.state, '', url);
      return continueGame();
    },
  };
}
