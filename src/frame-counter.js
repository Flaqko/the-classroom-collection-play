export function createFrameCounter(stage, targetRate) {
  const panel = document.createElement('output');
  panel.className = 'frame-counter';
  panel.setAttribute('aria-live', 'off');
  panel.hidden = true;
  stage.closest('.classroom-layout').append(panel);

  let start;
  let previous;
  let frames = 0;
  let updates = 0;
  let maxGap = 0;
  let maxWork = 0;

  function reset(now) {
    start = previous = now;
    frames = updates = maxGap = maxWork = 0;
  }

  window.addEventListener('keydown', event => {
    if (event.code !== 'F3') return;
    event.preventDefault();
    if (event.repeat) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) panel.textContent = 'Measuring frame timing…';
    reset();
  });
  document.addEventListener('visibilitychange', () => reset());

  return {
    get visible() { return !panel.hidden; },
    record(now, ticks, work) {
      if (panel.hidden) return;
      if (start === undefined) reset(now);
      else {
        frames += 1;
        maxGap = Math.max(maxGap, now - previous);
      }
      previous = now;
      updates += ticks;
      maxWork = Math.max(maxWork, work);

      const seconds = (now - start) / 1000;
      if (seconds < 1) return;
      panel.textContent = [
        'Browser  ' + Math.round(frames / seconds) + ' FPS',
        'Game     ' + Math.round(updates / seconds) + ' / ' + targetRate + ' updates/s',
        'Max gap  ' + maxGap.toFixed(1) + ' ms',
        'Max game work  ' + maxWork.toFixed(1) + ' ms',
      ].join('\n');
      reset(now);
    },
  };
}
