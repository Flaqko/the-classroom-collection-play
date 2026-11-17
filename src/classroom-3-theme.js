export const chapterLettering = [89, 91, 185, 187, 261, 311, 315, 323, 327, 329, 383, 420, 433, 447];

// Apply the collection's palette to the original animated scene artwork.
export function themeClassroomThree(defs) {
  const ns = defs.namespaceURI;
  const asset = id => defs.querySelector('#asset' + id);

  function appendShape(target, tag, attributes) {
    const shape = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attributes)) shape.setAttribute(name, value);
    target.append(shape);
  }

  function backdrop(id, x, panelY, panelHeight) {
    const background = asset(id);
    background.querySelector('path').setAttribute('fill', 'none');
    appendShape(background, 'rect', {
      x: x + 8, y: panelY, width: 284, height: panelHeight, rx: 23,
      class: id === 1 ? 'caught-screen-panel' : 'results-panel',
      fill: 'var(--title-panel)', stroke: 'var(--title-panel-border)', 'stroke-width': 4,
    });
  }

  function replaceFill(ids, from, to) {
    for (const id of ids) {
      for (const element of asset(id)?.querySelectorAll('[fill="' + from + '"]') ?? []) {
        element.setAttribute('fill', to);
      }
    }
  }

  // Chapter and act cards share the centered backdrop. Results use stage coordinates.
  backdrop(1, -150, -66, 132);
  backdrop(455, 0, 150, 100);

  for (const id of chapterLettering) {
    const lettering = asset(id);
    if (!lettering) continue;
    // The exported text uses a 300-unit line. Inset it within the panel.
    const line = document.createElementNS(ns, 'g');
    line.setAttribute('transform', 'translate(18 0) scale(.88 1)');
    line.append(...lettering.children);
    lettering.append(line);
  }

  replaceFill([163, 160, 514, 516, 518, 523, 525, 527, 529], '#ffffff', '#fff0b3');
  // Use a dark blue-gray for fade clips and the credits backdrop.
  replaceFill([8], '#000000', '#192d32');

  // The original credits are a Flash text field, animated by the source timeline.
  const credits = document.createElementNS(ns, 'g');
  credits.id = 'asset496';
  const lines = [
    'a game by:', 'luksy', '',
    'presented by:', 'ArmorGames', '',
    'produced by:', 'C404', '',
    'music by:', 'Terrence Fleming', 'Peter McConnell', 'Polyrhythm Addicts', '',
    'voiced by:', 'luksy', 'Petra', '',
    'beta tested by:', 'Luca "dELta" Deltodesco', '',
    'thank you:', 'Inglor', 'TwoDimensionalArray', 'CorkySurprise', 'Nick Makila',
    'Dan McNeeley', 'Luis Castanon', 'Petra', 'nodrim', 'ArmorGames.com',
    'Newgrounds.com', 'Fans of the game',
  ];
  lines.forEach((line, index) => {
    if (!line) return;
    appendShape(credits, 'text', {
      x: -6.1, y: 18 + index * 22, fill: '#fff',
      'font-family': 'Arial, sans-serif', 'font-size': 18, 'font-weight': 700,
      'text-anchor': 'middle',
    });
    credits.lastElementChild.textContent = line;
  });
  defs.append(credits);

}

export function setupClassroomThreeRoomEdges(stage) {
  const layout = stage.closest('.classroom-layout');
  const wrap = stage.parentElement;
  const backdropId = 'classroom-three-room-edge-art';

  function edge(side, viewBox) {
    const svg = document.createElementNS(stage.namespaceURI, 'svg');
    svg.classList.add('classroom-three-room-edge', 'room-edge-' + side);
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const art = document.createElementNS(stage.namespaceURI, 'use');
    art.setAttribute('href', '#' + backdropId);
    svg.append(art);
    layout.insertBefore(svg, wrap);
    return art;
  }

  const viewBox = stage.getAttribute('viewBox');
  const edges = [edge('left', viewBox), edge('right', viewBox)];
  const lowLight = edges.map(art => {
    const shade = document.createElementNS(stage.namespaceURI, 'use');
    shade.setAttribute('href', '#asset416');
    shade.setAttribute('display', 'none');
    art.after(shade);
    return shade;
  });
  return function syncRoomEdges(extendRightWall) {
    const hallway = stage.querySelector('[data-symbol="175"], [data-symbol="196"]');
    const wall = hallway ? null : stage.querySelector('[data-symbol="97"], [data-symbol="225"]');
    const backdrop = hallway ?? wall;
    if (!backdrop) return;

    if (backdrop.id !== backdropId) backdrop.id = backdropId;
    // Follow the live camera and any cutscene transforms without moving the playfield.
    const transforms = [];
    for (let node = backdrop.parentElement; node !== stage; node = node.parentElement) {
      const transform = node.getAttribute('transform');
      if (transform) transforms.unshift(transform);
    }
    const transform = transforms.join(' ');
    const lighting = stage.querySelector('[data-symbol="417"]')?.getAttribute('transform');
    for (const [index, art] of edges.entries()) {
      if (art.getAttribute('transform') !== transform) art.setAttribute('transform', transform);
      // Sample the same low-light gradient as the wall strip in the mini-camera room.
      const shade = lowLight[index];
      const display = lighting ? 'inline' : 'none';
      if (shade.getAttribute('display') !== display) shade.setAttribute('display', display);
      if (lighting && shade.getAttribute('transform') !== lighting) shade.setAttribute('transform', lighting);
      const edge = art.parentElement;
      const strip = wall || (index === 1 && extendRightWall);
      edge.classList.toggle('room-edge-wall', Boolean(strip));
      const bounds = strip ? (index === 0 ? '.1 0 .4 400' : '299.5 0 .4 400') : viewBox;
      if (edge.getAttribute('viewBox') !== bounds) edge.setAttribute('viewBox', bounds);
    }
  };
}


export function setupHallwayBackdrop(renderer, id, file, bounds) {
  const ns = renderer.svg.namespaceURI;
  // The image preserves the source symbol's origin at two pixels per game unit.
  const [x, y, width, height] = bounds;
  const url = 'assets/classroom-3/' + file;
  let pending;

  function replaceLiveArtwork(clip, definition, href) {
    if (clip.id === id) {
      const use = document.createElementNS(ns, 'use');
      use.setAttribute('href', href);
      clip.node.replaceChildren(use);
      clip.children.clear();
      clip.def = definition;
      clip.use = use;
      return;
    }
    for (const child of clip.children.values()) replaceLiveArtwork(child, definition, href);
  }

  return function prepareBackdrop() {
    if (pending) return;
    const preload = new Image();
    preload.src = url;
    pending = preload.decode().then(() => {
      const backdrop = document.createElementNS(ns, 'image');
      backdrop.id = 'asset' + id;
      backdrop.setAttribute('href', url);
      for (const [name, value] of Object.entries({x, y, width, height})) backdrop.setAttribute(name, value);
      renderer.defs.append(backdrop);

      const definition = {kind: 'asset', bounds: [x, y, x + width, y + height]};
      renderer.data.symbols[id] = definition;
      // Direct Continue and cutscenes can mount the vector art before the image is ready.
      replaceLiveArtwork(renderer.root, definition, '#' + backdrop.id);
    }).catch(() => { pending = undefined; });
  };
}
