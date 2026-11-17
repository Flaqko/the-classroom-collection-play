import {setupGamepad, advanceWithSpace} from './gamepad.js?v=controller-highlight';
import {createMovementInput} from './movement-input.js';
import {setupSideFades} from './side-fades.js';
import {setupCreditsSkip} from './credits-skip.js';
import {runFrameClock} from './frame-clock.js';
import {setupSceneEdges} from './scene-edges.js';
import {populatePasswords, resetPasswordSelection} from './password-list.js?v=password-select';
import {classroomThreeCreditsLoop, janitorHallMusicLoop} from './classroom-3-music.js';
import {chapterLettering, setupClassroomThreeRoomEdges, setupHallwayBackdrop, themeClassroomThree} from './classroom-3-theme.js';
import {setupPauseMenu} from './pause-menu.js';
import {setupAutosave} from './autosave.js';
import {Renderer} from './renderer.js';
import {OriginalAudio} from './audio.js';
import {overlaps} from './model.js';

const stage = document.querySelector('#stage');
const status = document.querySelector('#third-status');
const titleMenu = document.querySelector('#third-title');
const playOptions = document.querySelector('#third-play-options');
const passwords = document.querySelector('#password-list');
const passwordInput = passwords.querySelector('input');

const title = 35;
const chapterOne = 37;
const classroom = 39;
const outro = 46;
const actTwoIntro = 49;
const identifyGeek = 50;
const firstHall = 62;
const hallOutro = 71;
const hallwayPunchCuts = new Map([
  [56, 64],  // Before the windup
  [88, 98],  // Before impact audio
  [134, 264], // End the stationary impact pose after one second
  [309, 384], // Let the recovery settle briefly before the first cough
  [396, 409], // Shorten the pause before the Geek gets up
]);
const actFourClassroom = 73;
const actFiveClassroom = 82;
const actSixClassroom = 92;
const janitorHall = 103;
const cameraRoom = 112;
const ending = 164;
const rooms = [39, 50, 62, 73, 82, 92, 103, 112, 121, 132, 142];
const nextActs = [47, 61, 72, 81, 91, 101, 111, 120, 131, 141, ending];
// Chapter cards contain their act cards as nested clips.
const actCards = new Map([
  [37, [93, classroom]], [47, [189, actTwoIntro]], [48, [189, actTwoIntro]],
  [61, [263, firstHall]], [72, [313, 73]], [81, [317, 82]],
  [91, [325, 92]], [101, [331, janitorHall]], [102, [331, janitorHall]],
  [111, [385, cameraRoom]], [120, [422, 121]], [131, [435, 132]], [141, [449, 142]],
]);
const won = 148;
const caught = 154;
const credits = 174;
const tutorial = 185;
const tutorialCopy = 188;
const tutorialVision = 194;
const tutorialExit = 198;
const movement = [
  ['down', 0, 1], ['up', 0, -1],
  ['left', -1, 0], ['right', 1, 0],
];
const labels = {
  restart_button: 'Retry',
  mainMenu_button: 'Main menu',
};

async function asset(file) {
  const response = await fetch('assets/classroom-3/' + file);
  if (!response.ok) throw new Error('Unable to load ' + file);
  return response;
}

function extendEndingWalk(data) {
  const [{id, matrix: sceneMatrix}] = data.scenes[ending];
  const {frames} = data.symbols[id];
  const playerId = 131;
  const lastIndex = frames.findLastIndex(records => records.some(record => record.id === playerId));
  const last = frames[lastIndex].find(record => record.id === playerId);
  const previous = frames[lastIndex - 1].find(record => record.id === playerId);
  const [x, y] = last.matrix.slice(4);
  const dx = x - previous.matrix[4];
  const dy = y - previous.matrix[5];
  const topOfPlayer = data.symbols[130].bounds[1];

  // The original stops at the portrait edge. Keep walking down the hall until the player is below the screen.
  for (let step = 1; lastIndex + step < frames.length; step++) {
    const nextY = y + step * dy;
    if (sceneMatrix[5] + nextY + topOfPlayer >= data.height) break;
    frames[lastIndex + step].push({...last, matrix: [...last.matrix.slice(0, 4), x + step * dx, nextY]});
  }
}

async function loadGame() {
  const [metadata, artwork] = await Promise.all([asset('game.json'), asset('library.svg')]);
  const data = await metadata.json();
  extendEndingWalk(data);
  const audio = new OriginalAudio({
    ...data.audio,
    'level-complete': {file: '../../classroom-2/audio/222.mp3', stereo: false},
  }, 'assets/classroom-3/audio/');
  data.symbols[496].kind = 'asset';
  // The Restart animation swaps the named promotion for an unnamed copy.
  data.symbols[482].frames = data.symbols[482].frames.map(records =>
    records.filter(({id}) => id !== 64 && id !== 65)
  );
  const renderer = new Renderer(stage, data, await artwork.text(),
    () => undefined, advanceSourceButton);
  themeClassroomThree(renderer.defs);
  const prepareJanitorHall = setupHallwayBackdrop(renderer, 175, 'janitor-hall.png', [-630, -838, 1317, 1651]);
  const prepareGeekHall = setupHallwayBackdrop(renderer, 196, 'geek-hall.png', [-630, -405, 1317, 1178]);
  const syncSideFades = setupSideFades(stage, [8, 80, 82, 85, 86, 87],
    use => !use.closest('[data-symbol="508"]'));
  const syncRoomEdges = setupClassroomThreeRoomEdges(stage);
  const characterArtwork = [124, 129, 131, 159, 198, 199, 200, 201, 208, 209, 211, 267, 272, 285, 303, 305, 334];
  // Some source lines draw the bubble and lettering as separate symbols.
  const speechArtwork = [
    160, 161, 164, 165, 166, 167, 168, 169, 170, 178, 179, 181, 182, 183,
    212, 213, 214, 216, 217, 218, 219, 220, 221,
    283, 287, 288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 306, 307, 309,
    483, 484, 485, 486, 487, 488, 514, 516, 518, 523, 525, 527, 529,
  ];
  // The janitor hallway shadows share the camera transform of the floor.
  const syncSceneEdges = setupSceneEdges(stage, [...characterArtwork, 336, ...chapterLettering], speechArtwork);
  const hallwayFills = [
    [[191], '#6b9298', '#67858a'],
    [[192], '#7f7f7f', '#4e6970'],
    [[193], '#b7b7b7', '#78979a'],
    [[195], '#dfdfdf', '#78979a'],
    [[197], '#aeaeae', '#79a854'],
    [[203, 204, 205, 206, 207], '#c2c2c2', '#91b66b'],
    [[210, 298], '#8e8e8e', '#435dfa'],
    [[266, 285, 303, 305, 308], '#cccccc', '#f2cf37'],
  ].flatMap(([ids, original, colored]) => ids.flatMap(id =>
    [...renderer.defs.querySelectorAll('#asset' + id + ' [fill="' + original + '"]')]
      .map(path => ({path, original, colored}))
  ));
  const classroomFills = [
    [[225], '#878787', '#557479'],
    [[225], '#797979', '#476367'],
    [[227], '#868686', '#136a95'],
    [[227], '#747474', '#115e82'],
    [[229], '#999999', '#996600'],
    [[229, 231], '#888888', '#885b00'],
    [[231], '#797979', '#754f00'],
    [[232], '#b8b8b8', '#526d7e'],
    [[232], '#b4b4b4', '#83badb'],
    [[232], '#999999', '#486579'],
    [[234, 235, 236], '#cccccc', '#77ab45'],
    [[238, 241, 242], '#999999', '#c7a02a'],
    [[239], '#eaeaea', '#f2cf37'],
    [[246], '#656565', '#a73530'],
  ].flatMap(([ids, original, colored]) => ids.flatMap(id =>
    [...renderer.defs.querySelectorAll('#asset' + id + ' [fill="' + original + '"]')]
      .map(path => ({path, original, colored}))
  ));
  const classroomFloor = [...renderer.defs.querySelectorAll('#a224_gradient0 stop')]
    .map((stop, index) => ({stop, original: stop.getAttribute('stop-color'), colored: index === 0 ? '#78979a' : '#4d6c73'}));
  const hallwayGradients = [
    ['#a195_gradient0', '#cccccc', '#78979a'],
    ...[266, 285, 303, 305, 308].flatMap(id => [
      ['#a' + id + '_gradient0', '#999999', '#f2cf37'],
      ['#a' + id + '_gradient0', '#7f7f7f', '#c29e24'],
      ['#a' + id + '_gradient1', '#999999', '#a6821e'],
    ]),
  ].flatMap(([selector, original, colored]) =>
    [...renderer.defs.querySelectorAll(selector + ' [stop-color="' + original + '"]')]
      .map(stop => ({stop, original, colored}))
  );
  const caughtPanel = renderer.defs.querySelector(".caught-screen-panel");
  data.scenes[title] = [];
  for (const button of titleMenu.querySelectorAll('[data-action]')) {
    button.addEventListener('click', () => activate(button.dataset.action));
  }
  function advanceScene() {
    if (pauseMenu.paused) return false;
    if (scene === won) {
      const fader = renderer.find('faderMan');
      if (fader?.frame !== 21 || fader.running) return false;
      audio.stopSound('level-complete');
      startFade(fader);
      return true;
    }
    const control = dialogueControl();
    if (!control) return false;
    advanceSourceButton(control.id);
    refreshDialogue();
    return true;
  }

  setupCreditsSkip(stage, () => scene === credits, () => enter(title));
  const layout = stage.closest('.classroom-layout');
  layout.addEventListener('click', event => {
    if (event.target === layout || stage.contains(event.target)) advanceScene();
  });

  const movementInput = createMovementInput();
  const autosave = setupAutosave("third", checkpoint => enter(rooms[checkpoint - 1]));
  let scene;
  let endingRoom = false;
  let currentRoom = classroom;
  let foundGeek = false;
  let cameraLayer;
  let cameraPosition;
  const triggered = new Set();

  const pauseMenu = setupPauseMenu({
    stage, audio, clearInput: resetInput,
    canPause: () => scene >= chapterOne && scene !== credits,
    backToTitle: () => enter(title),
  });

  function tutorialScene(frame) {
    return frame >= tutorial && frame <= tutorialExit;
  }

  function roomIsActive() {
    return scene === tutorialCopy || scene === tutorialExit || rooms.includes(scene);
  }

  function resetInput() {
    movementInput.clear();
  }

  function setStatus() {
    if (scene === identifyGeek) {
      status.textContent = 'Find the geek and return to your seat.';
    } else if (scene === firstHall) {
      status.textContent = 'Use WASD or the arrow keys to reach the exit in the upper hallway.';
    } else if (scene === janitorHall) {
      status.textContent = 'Stay in the shadows and slip past the janitors to reach the exit.';
    } else if (scene === cameraRoom) {
      status.textContent = 'Move near the test to use the mini-camera automatically, then return to your seat.';
    } else if (scene === tutorialCopy || rooms.includes(scene)) {
      status.textContent = 'Move with WASD or the arrow keys. Copying starts automatically near the geek. Return to your seat when the bar is full.';
    } else if (scene === tutorialExit) {
      status.textContent = 'Use WASD or the arrow keys to reach the exit and watch the teacher’s vision cone.';
    } else if (scene === caught) {
      status.textContent = 'Caught. Retry to start the classroom again.';
    } else {
      status.textContent = '';
    }
  }

  function enter(frame) {
    pauseMenu.close();
    const keepMusic = (tutorialScene(scene) && tutorialScene(frame)) ||
      (scene === firstHall && frame === hallOutro);
    scene = frame;
    const destination = actCards.get(frame)?.[1] ?? frame;
    if ([outro, janitorHall, ending].includes(destination)) prepareJanitorHall();
    if ([actTwoIntro, firstHall, hallOutro].includes(destination)) prepareGeekHall();
    const colorHallway = frame === actTwoIntro || frame === firstHall || frame === hallOutro;
    const colorClassroom = [identifyGeek, actFourClassroom, actFiveClassroom, actSixClassroom].includes(frame);
    for (const {path, original, colored} of hallwayFills) {
      const shared = path.closest('#asset192, #asset197, #asset210');
      path.setAttribute('fill', colorHallway || (colorClassroom && shared) ? colored : original);
    }
    for (const {path, original, colored} of classroomFills) {
      path.setAttribute('fill', colorClassroom ? colored : original);
    }
    for (const {stop, original, colored} of classroomFloor) {
      stop.setAttribute('stop-color', colorClassroom ? colored : original);
    }
    for (const {stop, original, colored} of hallwayGradients) {
      stop.setAttribute('stop-color', colorHallway ? colored : original);
    }
    stage.classList.remove('hall-impact');
    pauseMenu.refresh();
    titleMenu.hidden = frame !== title;
    titleMenu.inert = false;
    endingRoom = false;
    foundGeek = false;
    triggered.clear();
    cameraLayer = undefined;
    cameraPosition = undefined;
    const checkpoint = rooms.indexOf(frame) + 1;
    if (checkpoint) {
      currentRoom = frame;
      autosave.save(checkpoint);
    }
    if (frame === title) currentRoom = classroom;
    resetInput();
    passwords.hidden = true;
    if (!keepMusic) audio.stop();
    renderer.mount(frame);
    syncSideFades();
    stage.dataset.frame = frame;
    caughtPanel.setAttribute("display", frame === caught ? "inline" : "none");
    setStatus();
    hideMarkers();
    if (frame === title) {
      audio.playLoop(44, .07, 18.87);

    } else if (frame === tutorial) {
      audio.play(49, {loops: 999});
    } else if (frame === firstHall) {
      audio.play(43, {loops: 999});
      if (data.audio[37]) audio.play(37, {loops: 999});
    } else if (frame === identifyGeek) {
      renderer.find('mcGeek').running = false;
      audio.play(40, {loops: 999});
    } else if (frame === janitorHall) {
      audio.playLoop(...janitorHallMusicLoop);
    } else if (frame === won) {
      const act = rooms.indexOf(currentRoom);
      const password = rootClip(470);
      password.setFrame(act === 0 ? 1 : act * 10);
      password.running = false;
      audio.play('level-complete');
    } else if (frame === cameraRoom) {
      renderer.visible('minicam', false);
    } else if (rooms.includes(frame)) {
      audio.play(40, {loops: 999});
    }
    // Scripted doorway entrances and exits are cropped by the original room boundary.
    if (frame === cameraRoom || frame === 121 || frame === 132) {
      renderer.find('teacher').node.dataset.clipToPlayfield = '';
    }
    const player = renderer.find('player');
    const scrollingHallway = frame === firstHall || frame === janitorHall;
    if (scrollingHallway) updateCamera(player);
    else if (roomIsActive()) player?.node.toggleAttribute('data-interpolate-motion', true);
    refreshDialogue();
    syncRoomEdges(frame === outro);
    syncSceneEdges();
    stage.focus({preventScroll: true});
    decorateControls();
    playEvents();
  }

  function startFade(fader) {
    if (!fader) return;
    if (fader.frame < 21) fader.setFrame(21);
    fader.running = true;
  }

  function hideMarkers() {
    const markers = ['map', 'place', 'hitPoint', 'getHelp', 'triggerMan', 'trigger1', 'trigger2', 'trigger3'];
    if (scene === janitorHall) markers.push('hall', 'shadows');
    for (const name of markers) renderer.visible(name, false);
  }

  function rootClip(id) {
    return [...renderer.root.children.values()].find(clip => clip.id === id);
  }

  function advanceSourceButton(id) {
    if (id === 162 && (scene >= tutorial && scene < tutorialCopy ||
      scene >= tutorialVision && scene < tutorialExit)) {
      renderer.gotoScene(++scene);
      if (roomIsActive()) renderer.find('player')?.node.toggleAttribute('data-interpolate-motion', true);
      stage.dataset.frame = scene;
      setStatus();
      hideMarkers();
      stage.focus({preventScroll: true});
      playEvents();
    } else if ([outro, actTwoIntro, hallOutro, ending].includes(scene) && (id === 162 || id === 171)) {
      const story = renderer.root.children.get(1);
      story.running = true;
      if (id === 162) {
        story.setFrame(story.frame + 1);
        story.action();
        // A consecutive click target marks another line that must wait for input.
        story.running &&= ![...story.children.values()].some(child => child.id === 162 || child.id === 171);
      }
      stage.focus({preventScroll: true});
    }
  }

  function dialogueControl() {
    if (scene >= tutorial && scene < tutorialCopy || scene >= tutorialVision && scene < tutorialExit) {
      return rootClip(162);
    }
    if (![outro, actTwoIntro, hallOutro, ending].includes(scene)) return;
    const story = renderer.root.children.get(1);
    if (!story || story.running) return;
    return [...story.children.values()].find(child => child.id === 162 || child.id === 171);
  }

  function refreshDialogue() {
    if (scene === hallOutro) {
      const story = rootClip(310);
      story.node.setAttribute('transform', 'translate(-150 170)');
      const camera = [...story.children.values()].find(child => child.id === 282);
      if (camera) camera.node.style.visibility = 'hidden';
    }
  }

  function playEvents() {
    for (const event of renderer.drainSounds()) {
      if (!data.audio[event.id]) continue;
      if (event.stop) audio.stopSound(event.id);
      else if (event.id === 46) audio.playLoop(46, .10, 4.669388);
      else if (scene === credits && event.id === 43) {
        if (event.frame === 1) audio.playLoop(...classroomThreeCreditsLoop);
      }
      else audio.play(event.id, event);
    }
  }

  function decorateControls() {
    if (scene !== caught) return;
    for (const [name, label] of Object.entries(labels)) {
      const control = renderer.find(name);
      if (!control) continue;
      if (control.node.hasAttribute('role')) {
        control.setFrame(control.frame + (control.hovered ? 1 : -1));
        continue;
      }
      const node = control.node;
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', label);
      node.setAttribute('tabindex', '0');
      node.classList.add('source-button');
      control.running = false;

      const bounds = control.localBounds();
      if (bounds) {
        const [left, top, right, bottom] = bounds;
        const hit = document.createElementNS(stage.namespaceURI, 'rect');
        hit.setAttribute('x', left);
        hit.setAttribute('y', top);
        hit.setAttribute('width', right - left);
        hit.setAttribute('height', bottom - top);
        hit.setAttribute('fill', 'transparent');
        node.append(hit);
        control.hit = hit;
      }
      node.addEventListener('pointerenter', () => { control.hovered = true; });
      node.addEventListener('pointerleave', () => { control.hovered = false; });
      node.addEventListener('click', () => activate(name));
      node.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        activate(name);
      });
    }
  }

  function activate(name) {
    if (!passwords.hidden) return;
    audio.unlock();
    switch (name) {
      case 'collectionBack':
        window.location.assign('collection.html?v=shared-fullscreen');
        break;
      case 'creditsButton':
        enter(credits);
        break;
      case 'newGame_button':
        enter(chapterOne);
        break;
      case 'tutorial_button':
        enter(tutorial);
        break;
      case 'restart_button':
        renderer.find('restart_button').parent.running = true;
        break;
      case 'mainMenu_button':
        enter(title);
        break;
      case 'password_button':
        passwords.hidden = false;
        titleMenu.inert = true;
        resetPasswordSelection(passwords);
        break;
    }
  }

  function updateRoom() {
    const player = renderer.find('player');
    if (!roomIsActive() || !player || endingRoom) return;
    const hallway = scene === firstHall || scene === janitorHall;
    const mapName = scene === firstHall ? 'hall1' : scene === janitorHall ? 'hall' : 'map';
    const speed = scene === firstHall ? 2.6 : scene === janitorHall ? 3.9 : 3;
    const [a, b, c, d] = player.matrix;
    let [x, y] = player.matrix.slice(4);
    for (const [key, dx, dy] of movement) {
      if (movementInput.directions[key] && !renderer.collision(x + dx * 8, y + dy * 8, mapName)) {
        x += dx * speed;
        y += dy * speed;
      }
    }
    player.matrix = [a, b, c, d, x, y];
    player.node.setAttribute('transform', 'matrix(' + player.matrix.join(',') + ')');

    if (hallway) {
      updateCamera(player);
      updateHallway(x, y);
      return;
    }

    const bounds = player.bounds();
    const inSeat = overlaps(bounds, renderer.bounds('place'));
    const nearGeek = overlaps(bounds, renderer.bounds('hitPoint'));
    const teacher = renderer.find('teacher');
    const vision = teacher?.find('fov');
    if (vision) {
      vision.running = false;
      const seen = vision.containsPaintedFill(x, y);
      if (scene === tutorialExit) {
        vision.setFrame(vision.frame + (seen ? 1 : -1));
      } else {
        const contact = renderer.bounds('mcTeacherHitPoint');
        const touched = scene === cameraRoom ? overlaps(bounds, contact) : overlaps([x, y, x, y], contact);
        if (seen && (scene === classroom || scene === cameraRoom || !inSeat)) vision.setFrame(vision.frame + 1);
        if (vision.frame >= 20 || touched) {
          enter(caught);
          return;
        }
      }
    }

    const fader = renderer.find('fader');
    if (scene === tutorialExit) {
      if (nearGeek && fader) {
        endingRoom = true;
        audio.stopSound(49);
        startFade(fader);
      }
      return;
    }
    let filled;
    if (scene === identifyGeek) {
      if (nearGeek && !foundGeek) {
        foundGeek = true;
        const geek = renderer.find('mcGeek');
        geek.setFrame(15);
        geek.running = false;
        status.textContent = 'You found the geek. Return to your seat.';
      }
      filled = foundGeek;
    } else {
      const bar = renderer.find(scene === cameraRoom ? 'minicam' : 'cheat_bar');
      if (!bar) return;
      const usingCamera = scene === cameraRoom;
      filled = bar.frame >= (usingCamera ? 536 : 261);
      bar.running = !filled && nearGeek && (!usingCamera || teacher.frame < 1545);
      if (usingCamera) {
        renderer.visible('minicam', bar.running);
        if (bar.frame >= 225 && teacher.frame === 1) teacher.running = true;
        if (teacher.frame === 990) {
          const figure = teacher.find('teacher2');
          if (figure?.def.frames.length >= 13) {
            figure.setFrame(13);
            figure.running = true;
          }
        }
        if (teacher.frame === 1896) {
          enter(111);
          return;
        }
      }
    }
    if (!filled || !inSeat) return;
    endingRoom = true;
    if (scene === classroom) {
      const teacher = renderer.find('teacher');
      teacher.running = false;
      if (vision) vision.running = false;
      teacher.find('balloon_level1').running = true;
    } else if (fader) {
      startFade(fader);
    }
  }

  function updateCamera(player) {
    const camera = scene === firstHall ? rootClip(279) : renderer.find('mcCam');
    if (!camera || !player) return;
    const scale = 1 / camera.matrix[0];
    const width = 300 / scale;
    const height = 400 / scale;
    const worldWidth = scene === firstHall ? 1115 : 1116;
    const worldHeight = scene === firstHall ? 948 : 1271;
    if (!cameraLayer) {
      cameraLayer = document.createElementNS(stage.namespaceURI, 'g');
      cameraLayer.dataset.worldSpeech = '';
      renderer.root.node.prepend(cameraLayer);
      for (const child of renderer.root.children.values()) {
        if (child !== camera && child.name !== 'faderMan' && child.name !== 'faderMan2') cameraLayer.append(child.node);
      }
      // The objective and eye indicator are screen overlays, independent of world scrolling.
      const hud = camera.matrix.slice(0, 4).map(value => value * scale);
      camera.node.setAttribute('transform', 'matrix(' + [...hud, 0, 0].join(' ') + ')');
      cameraPosition = camera.matrix.slice(4);
    }
    const [x, y] = player.matrix.slice(4);
    const clamp = (value, limit) => Math.min(Math.max(0, limit), Math.max(0, value));
    const follow = (current, target, limit) => {
      const destination = clamp(target, limit);
      const delta = destination - current;
      return Math.abs(delta) < .05 ? destination : clamp(current + delta / 10, limit);
    };
    const left = follow(cameraPosition[0], x - width / 2, worldWidth - width);
    const top = follow(cameraPosition[1], y - height / 2, worldHeight - height);
    if (left === cameraPosition[0] && top === cameraPosition[1] && cameraLayer.hasAttribute('transform')) return;
    cameraPosition = [left, top];
    cameraLayer.setAttribute('transform', 'matrix(' + [scale, 0, 0, scale, -left * scale, -top * scale].join(',') + ')');
  }

  function updateHallway(x, y) {
    const hits = name => renderer.find(name)?.contains(x, y);
    if (scene === firstHall) {
      if (hits('triggerMan') && !triggered.has('triggerMan')) {
        triggered.add('triggerMan');
        status.textContent = 'Keep going after the conversation. The exit is in the upper hallway.';
        renderer.find('hall_balloon').running = true;
      }
      if (!hits('hitPoint')) return;
    } else {
      const hidden = hits('shadows');
      renderer.find('mcEye')?.setFrame(hidden ? 2 : 1);
      const guards = ['janitor1', 'janitor2', 'janitor3'].map(name => renderer.find(name));
      for (const guard of guards) {
        for (const name of ['fov', 'fov2', 'fov3']) {
          const vision = guard?.find(name);
          if (!vision) continue;
          vision.running = false;
          if (!hidden && vision.containsPaintedFill(x, y)) vision.setFrame(vision.frame + 1);
          if (vision.frame >= 10) {
            enter(caught);
            return;
          }
        }
      }
      if (hits('trigger1') && !triggered.has('trigger1')) {
        triggered.add('trigger1');
        guards[0].running = true;
      }
      if (hits('trigger2') && !triggered.has('trigger2')) {
        triggered.add('trigger2');
        guards[2].setFrame(141);
        guards[2].running = true;
      }
      if (!hits('trigger3')) return;
    }
    endingRoom = true;
    renderer.find('faderMan2').running = true;
  }

  populatePasswords(passwords, data.passwords.map(({act, word}) => ({
    label: `${act}.`, password: word,
  })));

  passwords.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const word = passwordInput.value.trim().toLowerCase();
    const entry = data.passwords.find(candidate => candidate.word === word);
    if (entry) enter(entry.frame);
    else {
      status.textContent = 'Select a password first.';
    }
  });

  document.querySelector('#close-passwords').addEventListener('click', () => {
    passwords.hidden = true;
    status.textContent = '';
    titleMenu.inert = false;
    playOptions.querySelector('[data-action=password_button]').focus();
  });

  window.addEventListener('blur', resetInput);
  window.addEventListener('keydown', event => {
    if (event.target === stage && !event.repeat &&
        (event.key === 'Enter' || event.key === ' ') && advanceScene()) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && event.code === 'KeyF' && !event.repeat &&
        !pauseMenu.paused && roomIsActive() && !endingRoom) {
      const bar = renderer.find(scene === cameraRoom ? 'minicam' : 'cheat_bar');
      if (bar) {
        event.preventDefault();
        bar.setFrame(scene === cameraRoom ? 536 : 261);
        bar.running = false;
      }
      return;
    }
    if (!pauseMenu.paused && roomIsActive() && movementInput.press(event)) event.preventDefault();
  });
  window.addEventListener('keyup', event => movementInput.release(event));
  window.addEventListener('pointerdown', () => audio.unlock(), {once: true});
  window.addEventListener('keydown', () => audio.unlock(), {once: true});
  document.addEventListener('visibilitychange', () => {
    resetInput();
    if (document.hidden) audio.pause();
    else if (!pauseMenu.paused) audio.resume();
  });

  if (!autosave.resumeFromLink()) enter(title);
  function tick() {
    if (document.hidden || pauseMenu.paused) return;
    renderer.advance();
    const clip = renderer.root.children.get(1);
    const fader = renderer.find('fader');
    const card = actCards.get(scene);
    if (card) {
      const [id, target] = card;
      const act = clip?.id === id ? clip : [...(clip?.children.values() ?? [])].find(child => child.id === id);
      if (act?.frame === 80) return enter(target);
    }
    if (scene === actTwoIntro && clip?.frame === 28) audio.stopSound(46);
    if (scene === actTwoIntro && clip?.frame === 156) return enter(identifyGeek);
    refreshDialogue();
    if (scene === hallOutro) {
      const jump = hallwayPunchCuts.get(clip.frame);
      if (jump !== undefined && clip.running) {
        clip.setFrame(jump);
        clip.action();
      }
      const impactFrame = 99;
      stage.classList.toggle('hall-impact', clip.frame >= impactFrame && clip.frame < impactFrame + data.fps);
      if (clip.frame === impactFrame - 1) audio.stopSound(37);
    }
    if (scene === hallOutro && clip?.frame === 474) return enter(won);
    if (scene === ending && clip?.frame === 373) audio.play(27);
    if (scene === ending && clip?.frame === 248) audio.stopSound(46);
    if (scene === ending && clip?.frame === 411) return enter(credits);
    if (endingRoom && renderer.find('faderMan2')?.frame === 20) {
      return enter(scene === firstHall ? hallOutro : won);
    }
    if (scene === credits && clip?.frame === 1100) return enter(title);
    if (scene === caught && clip?.frame === 37) return enter(currentRoom);
    if (scene === outro) {
      const storyFrame = renderer.find('level1_outro')?.frame;
      if (storyFrame === 77) audio.stopSound(46);
      if (storyFrame === 115) return enter(won);
    }
    if (scene === won && renderer.find('faderMan')?.frame === 41) return enter(nextActs[rooms.indexOf(currentRoom)]);
    if (scene === classroom && renderer.find('balloon_level1')?.frame === 141) {
      startFade(fader);
    }
    if (endingRoom && fader?.frame === 41) {
      if (scene === classroom) return enter(outro);
      if (scene === tutorialCopy) return enter(tutorialVision);
      if (scene === tutorialExit) return enter(chapterOne);
      return enter(won);
    }
    updateRoom();
    syncRoomEdges(scene === outro);
    syncSceneEdges();
    syncSideFades();
    decorateControls();
    playEvents();
  }
  setupGamepad({
    surface: layout, movement: movementInput, pauseMenu,
    goBack: () => {
      if (!passwords.hidden) document.querySelector('#close-passwords').click();
      else if (scene === title) activate('collectionBack');
      else if (tutorialScene(scene) || scene === credits) enter(title);
      else return false;
      return true;
    },
    canMove: roomIsActive, advance: () => advanceWithSpace(stage), unlock: () => audio.unlock(),
  });
  runFrameClock(data.fps, tick, () => document.hidden || pauseMenu.paused, stage);
}

loadGame().catch(error => {
  status.textContent = 'Could not load The Classroom 3.';
  console.error(error);
});
