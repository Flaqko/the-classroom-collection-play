const ns = 'http://www.w3.org/2000/svg';
const visualAttributes = ['transform', 'opacity', 'filter', 'visibility', 'style'];

export function setupSceneEdges(stage, artworkIds, speechIds) {
  const layout = stage.closest('.classroom-layout');
  const overlay = document.createElementNS(ns, 'svg');
  overlay.classList.add('scene-edges');
  overlay.setAttribute('aria-hidden', 'true');
  const viewport = document.createElementNS(ns, 'svg');
  viewport.setAttribute('viewBox', stage.getAttribute('viewBox'));
  overlay.append(viewport);
  layout.insertBefore(overlay, stage.parentElement);

  const projectedIds = new Set(artworkIds.map(String));
  const dialogueIds = new Set(speechIds.map(String));
  const characterName = /^(?:player|teacher(?!.*hit)|geek|mcGeek$|janitor)/;
  const keepSpeechInView = setupSpeechFraming(stage);
  const projections = new WeakMap();
  let nextId = 0;

  return function syncSceneEdges() {
    // Only inspect the mounted display list. The much larger SVG library is in defs.
    const root = stage.querySelector(':scope > [data-symbol="-1"]');
    const speech = [];
    const selected = new Set();
    for (const node of root?.querySelectorAll('[data-symbol]') ?? []) {
      if (dialogueIds.has(node.dataset.symbol)) speech.push(node);
      if (projectedIds.has(node.dataset.symbol) || characterName.test(node.dataset.name ?? '')) selected.add(node);
    }
    keepSpeechInView(speech);
    const layers = [];
    for (const artwork of selected) {
      if (artwork.closest('[data-clip-to-playfield]')) continue;
      let parentIsProjected = false;
      for (let parent = artwork.parentElement; parent !== stage; parent = parent.parentElement) {
        if (selected.has(parent)) {
          parentIsProjected = true;
          break;
        }
      }
      if (parentIsProjected) continue;
      const ancestors = [];
      for (let parent = artwork.parentElement; parent !== stage; parent = parent.parentElement) {
        ancestors.push(parent);
      }

      let projection = projections.get(artwork);
      if (projection?.groups.length !== ancestors.length) {
        if (!artwork.id) artwork.id = 'widescreen-artwork-' + ++nextId;
        const use = document.createElementNS(ns, 'use');
        use.setAttribute('href', '#' + artwork.id);
        const motion = document.createElementNS(ns, 'g');
        motion.append(use);
        let layer = motion;
        const groups = ancestors.map(() => {
          const group = document.createElementNS(ns, 'g');
          group.append(layer);
          layer = group;
          return group;
        });
        projection = {layer, groups, motion, use};
        projections.set(artwork, projection);
      }

      if (artwork.hasAttribute('data-interpolate-motion')) {
        const transform = artwork.getAttribute('transform');
        if (projection.motion.getAttribute('transform') !== transform) {
          // A use element mirrors the source target, so animate its position in our own group.
          const matrix = artwork.transform.baseVal.getItem(0).matrix.inverse();
          projection.use.setAttribute('transform', 'matrix(' +
            [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].join(' ') + ')');
          projection.motion.setAttribute('transform', transform);
          projection.motion.toggleAttribute('data-interpolate-motion', true);
        }
      }

      for (const [index, parent] of ancestors.entries()) {
        const group = projection.groups[index];
        for (const name of visualAttributes) {
          const value = parent.getAttribute(name);
          if (value === group.getAttribute(name)) continue;
          if (value === null) group.removeAttribute(name);
          else group.setAttribute(name, value);
        }
      }
      layers.push(projection.layer);
    }
    if (layers.length !== viewport.children.length ||
        layers.some((layer, index) => layer !== viewport.children[index])) {
      viewport.replaceChildren(...layers);
    }
  };
}

function setupSpeechFraming(stage) {
  const offsets = new WeakMap();
  let framed = new WeakMap();
  new ResizeObserver(() => { framed = new WeakMap(); }).observe(stage);

  return function keepSpeechInView(speech) {
    if (!speech.length) return;

    const groups = new Map();
    for (const node of speech) {
      if (node.closest('[data-world-speech]')) continue;
      if (!groups.has(node.parentElement)) groups.set(node.parentElement, []);
      groups.get(node.parentElement).push(node);
    }

    for (const [parent, parts] of groups) {
      const transforms = parts.map(part => part.getAttribute('transform'));
      for (let node = parent; node !== stage; node = node.parentElement) {
        transforms.push(node.getAttribute('transform'));
      }
      const signature = transforms.join('|');
      const previous = framed.get(parent);
      if (previous?.signature === signature && parts.length === previous.parts.length &&
          parts.every((part, index) => part === previous.parts[index])) continue;
      framed.set(parent, {signature, parts});

      const viewport = stage.getBoundingClientRect();
      const padding = viewport.width / 100;
      const matrix = parent.getScreenCTM();
      if (!matrix || matrix.a * matrix.d === matrix.b * matrix.c) continue;
      let left = Infinity;
      let right = -Infinity;
      for (const part of parts) {
        const bounds = part.getBoundingClientRect();
        if (!bounds.width) continue;
        const offset = offsets.get(part);
        const previousX = offset ? matrix.a * offset.x + matrix.c * offset.y : 0;
        left = Math.min(left, bounds.left - previousX);
        right = Math.max(right, bounds.right - previousX);
      }
      if (left === Infinity) continue;

      // Keep the original bubble and lettering together when they approach an edge.
      const shift = Math.max(viewport.left + padding - left,
        Math.min(0, viewport.right - padding - right));
      const inverse = matrix.inverse();
      const x = inverse.a * shift;
      const y = inverse.b * shift;
      for (const part of parts) {
        const previous = offsets.get(part);
        if (previous?.x === x && previous.y === y) continue;
        if (shift) part.style.translate = x + 'px ' + y + 'px';
        else part.style.removeProperty('translate');
        offsets.set(part, {x, y});
      }
    }
  };
}
