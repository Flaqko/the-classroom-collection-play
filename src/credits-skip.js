export function setupCreditsSkip(stage, isCredits, backToTitle) {
  const layout = stage.closest('.classroom-layout');
  layout.addEventListener('click', event => {
    if (isCredits() && (event.target === layout || stage.contains(event.target))) backToTitle();
  });

  const reservedKeys = new Set(['Alt', 'Control', 'Meta', 'Shift', 'F3']);
  window.addEventListener('keydown', event => {
    if (!isCredits() || event.repeat || event.defaultPrevented ||
        event.ctrlKey || event.altKey || event.metaKey || reservedKeys.has(event.key)) return;
    event.preventDefault();
    backToTitle();
  });
}
