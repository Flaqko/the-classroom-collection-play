export function setupSideFades(stage, ids, include = () => true) {
  const overlay = document.createElementNS(stage.namespaceURI, 'svg');
  overlay.classList.add('classroom-side-fades');
  overlay.setAttribute('viewBox', stage.getAttribute('viewBox'));
  overlay.setAttribute('preserveAspectRatio', 'none');
  overlay.setAttribute('aria-hidden', 'true');
  stage.closest('.classroom-layout').append(overlay);

  // The source faders are solid-color shapes. Stretch their color and opacity to the full viewport.
  const fadeAssets = ids.map(id => '[data-symbol="' + id + '"] > use').join(', ');
  const defs = stage.querySelector('defs');
  let lastFrame = '';
  return function syncSideFades() {
    const root = stage.querySelector(':scope > [data-symbol="-1"]');
    const fades = [];
    for (const use of root?.querySelectorAll(fadeAssets) ?? []) {
      if (!include(use)) continue;
      const path = defs.querySelector(use.getAttribute('href'))?.querySelector('path');
      const fill = path?.getAttribute('fill');
      if (!fill || fill === 'none') continue;
      let opacity = Number(path.getAttribute('fill-opacity') ?? 1);
      for (let parent = use.parentElement; parent !== stage; parent = parent.parentElement) {
        opacity *= Number(parent.getAttribute('opacity') ?? 1);
      }
      const filter = use.parentElement.getAttribute('filter');
      if (opacity) fades.push([fill, opacity, filter]);
    }

    const frame = fades.map(values => values.join(' ')).join('|');
    if (frame === lastFrame) return;
    lastFrame = frame;
    overlay.replaceChildren(...fades.map(([fill, opacity, filter]) => {
      const shade = document.createElementNS(stage.namespaceURI, 'rect');
      shade.setAttribute('width', '100%');
      shade.setAttribute('height', '100%');
      shade.setAttribute('fill', fill);
      shade.setAttribute('opacity', opacity);
      if (filter) shade.setAttribute('filter', filter);
      return shade;
    }));
  };
}
