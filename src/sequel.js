import {setupGamepad, advanceWithSpace} from './gamepad.js?v=controller-highlight';
import {createMovementInput} from './movement-input.js';
import {setupSideFades} from './side-fades.js';
import {setupCreditsSkip} from './credits-skip.js';
import {runFrameClock} from './frame-clock.js';
import {setupSceneEdges} from './scene-edges.js';
import {populatePasswords, resetPasswordSelection} from './password-list.js?v=password-select';
import {setupPauseMenu} from './pause-menu.js';
import {setupAutosave} from './autosave.js';
import {setupRemaster} from './remaster.js';
import {Renderer} from './renderer.js';
import {OriginalAudio} from './audio.js';
import {overlaps} from './model.js';

const stage = document.querySelector('#stage');
const status = document.querySelector('#sequel-status');
const sendMelanie = document.querySelector('#send-melanie');
const titleMenu = document.querySelector('#sequel-title');
const passwordPanel = document.querySelector('#password-list');
const passwordInput = passwordPanel.querySelector('input');
const title = 253;
const credits = 9126;
const menuCreditsStart = 9250;
const collectionBack = 'collection-back';
const caught = 265;
const firstClassroom = 953;
const samuelClassroom = 1176;
const melanieClassroom = 3861;
const copyRooms = new Set([1804, 1947, 2090, 3861, 4224, 5299, 5442, 5585, 5728, 7549]);
const checkpointRooms = [953, 1804, 1947, 2090, 2538, 3861, 4224, 5299, 5442, 5585, 5728, 6835, 7549];
const storyButtons = [293, 307, 311, 367, 512, 515];

async function fetchAsset(file) {
  const response = await fetch(`assets/classroom-2/${file}`);
  if (!response.ok) throw new Error(`Unable to load ${file}`);
  return response;
}

async function loadGame() {
  const [metadata, artwork] = await Promise.all([fetchAsset('game.json'), fetchAsset('library.svg')]);
  const data = await metadata.json();
  data.scenes[title] = [];
  data.sceneSounds = data.sceneSounds.filter(event => event.id !== 'credits');
  // Place the pickup indicator past the right edge of the classroom.
  const pickupNotifier = data.scenes[6835].find(record => record.name === 'notifier');
  pickupNotifier.matrix[4] = 335;
  for (let frame = 5935; frame <= 6209; frame++) {
    for (const record of data.scenes[frame]) {
      if (record.id === 219) record.matrix[5] = 200;
    }
  }
  // Keep both tests on their desks when the player or the fleeing student leaves.
  const classroomTests = data.scenes[5728].filter(record => record.id === 323);
  classroomTests.find(record => record.depth === 157).matrix[5] = 229.2;
  classroomTests.find(record => record.depth === 159).matrix[5] = 169;
  // The same narrow overlay masks captions throughout the campaign.
  for (const [frame, records] of Object.entries(data.scenes)) {
    const mask = records.find(record => record.id === 219 && record.matrix[3] < 1);
    if (!mask) continue;
    data.scenes[frame] = records.filter(record => record !== mask).map(record =>
      record.id === 219 ? record : {...record, alpha: record.alpha * (1 - mask.alpha)}
    );
  }

  for (const button of titleMenu.querySelectorAll("[data-route]")) {
    const route = button.dataset.route;
    button.addEventListener("click", () => navigate(route === collectionBack ? route : Number(route)));
  }
  // Bubble panels, tails, and lettering occupy adjacent depths in the story frames.
  const speechArtwork = new Set();
  for (const records of Object.values(data.scenes)) {
    const start = records.findIndex(record => record.id === 288);
    if (start === -1) continue;
    for (const record of records.slice(start)) {
      if (storyButtons.includes(record.id) || record.id === 219) break;
      if (data.symbols[record.id]?.kind === 'asset') speechArtwork.add(record.id);
    }
  }
  const syncSceneEdges = setupSceneEdges(stage, [7, 342, 554, 556, pickupNotifier.id], [...speechArtwork]);
  const audio = new OriginalAudio(data.audio, 'assets/classroom-2/audio/');
  const renderer = new Renderer(stage, data, await artwork.text(), id => data.buttons[id]?.label, navigate);
  // Flash uses shape 664 to mask the student as they step out of the stall.
  const stallClip = document.createElementNS(stage.namespaceURI, 'clipPath');
  stallClip.id = 'sequel-stall-clip';
  for (const path of renderer.defs.querySelectorAll('#asset664 path')) {
    stallClip.append(path.cloneNode());
  }
  renderer.defs.append(stallClip);
  await setupRemaster(renderer.defs, 'sequel');
  const syncSideFades = setupSideFades(stage, [219, 347, 348, 350, 351], use =>
    !(stage.classList.contains('sequel-opening') && use.parentElement.dataset.symbol === '219')
  );
  const stops = new Set(data.stops);
  const soundStops = new Set(data.soundStops);
  const movementInput = createMovementInput();
  const autosave = setupAutosave("sequel", checkpoint => enter(checkpointRooms[checkpoint - 1]));
  let frame, playing, playerPosition, activePlayer, doorTriggered, teacherVisible;
  let retryFrame, copied, gotTest, finishing, patrolRequested;

  const pauseMenu = setupPauseMenu({
    stage, audio, clearInput: resetInput,
    canPause: () => frame >= caught && frame < credits,
    backToTitle: () => enter(title),
  });

  setupCreditsSkip(stage, () => frame >= credits, () => enter(title));

  function room() {
    if (frame >= firstClassroom && frame <= samuelClassroom) return 'tutorial';
    if (frame === 2538) return 'shortCopy';
    if (frame === 6835) return 'pickup';
    if (copyRooms.has(frame)) return 'copy';
  }

  function navigate(id) {
    if (id === collectionBack) {
      window.location.assign('collection.html');
      return;
    }
    const route = data.buttons[id];
    if (!route) return;
    if (id === 198) {
      const retry = retryFrame;
      enter(retry, retry === 746);
      return;
    }
    const target = route.target ?? frame + route.relative;
    if (!data.scenes[target]) return;
    if (target <= 264 || target === 266 || target === credits) {
      enter(target === credits ? menuCreditsStart : target, target === 266 || target === credits);
    } else {
      moveTimeline(target, !!route.play);
      flushEvents();
    }
  }

  function enter(target, play = false) {
    pauseMenu.close();
    movementInput.clear();
    const usesTitleMusic = (target >= title && target < caught) || target >= credits;
    const keepTitleMusic = usesTitleMusic && audio.loop?.id === 2;
    if (!keepTitleMusic) audio.stop();
    playerPosition = null;
    activePlayer = null;
    doorTriggered = false;
    teacherVisible = false;
    copied = false;
    gotTest = false;
    finishing = false;
    patrolRequested = false;
    if (target !== caught) retryFrame = 746;
    playing = play;
    frame = target;
    renderer.mount(frame);
    if (frame === firstClassroom) {
      // Continue starts after the scripted entrance, whose blue character is still present before frame 179.
      const classroom = renderer.find('class_level1_1');
      classroom.setFrame(179);
      classroom.action();
    }
    refreshScene();
    syncSceneEdges();
    syncSideFades();
    flushEvents();
    if (usesTitleMusic && !keepTitleMusic) audio.playLoop(2, .22, 10.02);
    if (frame === 254) {
      resetPasswordSelection(passwordPanel);
    } else stage.focus({preventScroll: true});
  }

  function moveTimeline(target, play = true) {
    const jump = data.jumps[target];
    if (jump) {
      if (jump.target <= caught) {
        enter(jump.target < title ? title : jump.target);
        return;
      }
      target = jump.target;
      play = jump.play;
    }
    frame = target;
    playing = play && !stops.has(frame);
    renderer.gotoScene(frame);
    refreshScene();
  }

  function getPlayer() {
    if (room() === 'tutorial') return renderer.find('player_level1_1');
    if (room()) return renderer.find(frame === 1804 ? 'player_level2_1' : 'player');
  }

  function placeProgressBar() {
    const bar = renderer.find('cheatbar');
    if (!bar) return;
    // Keep the full meter in the right side of the 16:9 frame.
    bar.matrix = [...bar.matrix.slice(0, 4), 313, bar.matrix[5]];
    const transform = 'matrix(' + bar.matrix.join(',') + ')';
    if (bar.node.getAttribute('transform') !== transform) bar.node.setAttribute('transform', transform);
  }

  function pendingDistraction() {
    const teacher = frame === melanieClassroom ? renderer.find('teacher') : null;
    return teacher?.frame < 51 ? teacher : null;
  }

  function startDistraction() {
    const teacher = pendingDistraction();
    if (!teacher || pauseMenu.paused) return;
    teacher.setFrame(51);
    teacher.running = true;
    sendMelanie.hidden = true;
    stage.focus({preventScroll: true});
    flushEvents();
  }

  sendMelanie.addEventListener('click', startDistraction);

  function refreshScene() {
    sendMelanie.hidden = !pendingDistraction();
    placeProgressBar();
    stage.dataset.frame = frame;
    const bathroom = data.scenes[frame].some(record => record.id === 277);
    const stallMask = renderer.root.children.get(42);
    if (stallMask?.id === 664) {
      stallMask.node.setAttribute('visibility', 'hidden');
      const student = renderer.root.children.get(43);
      if (student?.id === 285) {
        const [, , , , x, y] = student.matrix;
        stallClip.setAttribute('transform', 'translate(' + -x + ' ' + -y + ')');
        student.node.setAttribute('clip-path', 'url(#sequel-stall-clip)');
      }
    }
    // Keep scripted doorway movement behind the room edge.
    renderer.find('teacher')?.node.toggleAttribute('data-clip-to-playfield',
      frame === 2538 || frame === 4224 || frame === 5728);
    for (const character of renderer.root.children.values()) {
      if (character.id === 7) character.node.toggleAttribute('data-clip-to-playfield', bathroom);
    }
    const classroomFlashback = frame >= 5935 && frame < 6071;
    stage.classList.toggle('sequel-classroom-flashback', classroomFlashback);
    stage.classList.toggle('sequel-flashback', frame >= 6071 && frame <= 6209);
    stage.classList.toggle('sequel-flashback-blackout', frame >= 6344 && frame <= 6370);
    stage.classList.toggle('sequel-ending-street', frame >= 8321 && frame < credits);
    stage.classList.toggle('sequel-opening', frame >= 266 && frame < 746);
    stage.classList.toggle('sequel-classroom', bathroom || classroomFlashback || Boolean(room()) || (frame >= 746 && frame < firstClassroom));
    pauseMenu.refresh();
    titleMenu.hidden = frame !== title;
    passwordPanel.hidden = frame !== 254;
    if (soundStops.has(frame)) audio.stop();
    const player = getPlayer();
    if (player && player !== activePlayer) {
      const checkpoint = checkpointRooms.indexOf(frame) + 1;
      if (checkpoint) autosave.save(checkpoint);
      activePlayer = player;
      playerPosition = player.matrix.slice(4);
      if (room() !== 'tutorial') {
        retryFrame = frame;
        copied = false;
        gotTest = false;
        finishing = false;
        patrolRequested = false;
      }
    }
    if (!player) activePlayer = null;
    placePlayer(player);
    renderer.visible('teacher_level1_1', teacherVisible);
    for (const name of ['hit_level1_1', 'level1_1_samuelHit', 'level1_1_samuelHit2',
      'hitpoint_level2_1', 'safepoint_level2_1', 'hitpoint', 'safepoint']) {
      renderer.visible(name, false);
    }
    if (frame === caught) status.textContent = 'Caught. Retry to return to the classroom.';
    else if (frame === firstClassroom) status.textContent = 'Use WASD or the arrow keys to move toward the middle of the classroom.';
    else if (frame === samuelClassroom) status.textContent = 'Approach Samuel to continue the conversation.';
    else if (room() === 'copy') status.textContent = 'Move near the test to copy automatically, then return to your seat.';
    else if (room() === 'shortCopy') status.textContent = 'Move near the test to copy automatically.';
    else if (room() === 'pickup') status.textContent = 'Pick up the test and return to your seat.';
    else status.textContent = '';
  }

  function placePlayer(player) {
    if (!player || !playerPosition) return;
    const matrix = [...player.matrix.slice(0, 4), ...playerPosition];
    player.matrix = matrix;
    player.node.toggleAttribute('data-interpolate-motion', true);
    player.node.setAttribute('transform', `matrix(${matrix.join(' ')})`);
  }

  function movePlayer(player, classroom) {
    let [x, y] = playerPosition;
    const [left, top, right, bottom] = player.bounds();
    const leftOffset = left - x;
    const rightOffset = right - x;
    const topOffset = top - y;
    const bottomOffset = bottom - y;
    const speed = 3;
    if (movementInput.directions.down) y += speed;
    if (movementInput.directions.up) y -= speed;
    if (movementInput.directions.left) x -= speed;
    if (movementInput.directions.right) x += speed;
    const solid = (px, py) => renderer.collision(px, py, classroom);
    if (solid(x + rightOffset, y)) x -= speed;
    if (solid(x + leftOffset, y)) x += speed;
    if (solid(x, y + bottomOffset)) y -= speed;
    if (solid(x, y + topOffset)) y += speed;
    playerPosition = [x, y];
    placePlayer(player);
  }

  function updateTutorial(bounds) {
    if (!doorTriggered && overlaps(bounds, renderer.bounds('hit_level1_1'))) {
      doorTriggered = true;
      renderer.find('class_level1_1').running = true;
      if (frame === firstClassroom) playing = true;
    }
    const samuel = renderer.find('samuel_level1_1');
    if (samuel && ['level1_1_samuelHit', 'level1_1_samuelHit2'].some(name =>
      overlaps(bounds, samuel.find(name)?.bounds()))) {
      samuel.running = true;
    }
  }

  function updateVision(safe) {
    const red = renderer.find('fov_red');
    if (!red) return false;
    red.running = false;
    const seen = !safe && red.containsPaintedFill(...playerPosition);
    red.setFrame(red.frame + (seen ? 1 : -1));
    if (red.frame < 15) return false;
    enter(caught);
    return true;
  }

  function updateClassroom() {
    const mode = room();
    const player = getPlayer();
    if (!player || !playerPosition || finishing) return;
    const classroom = mode === 'tutorial' ? 'class_level1_1' : mode === 'shortCopy' ? 'class_level2_5' : 'class_level2_1';
    movePlayer(player, classroom);
    const bounds = player.bounds();
    if (mode === 'tutorial') {
      updateTutorial(bounds);
      return;
    }
    if (mode === 'shortCopy' && patrolRequested) {
      for (const name of ['teacher', 'class_level2_5']) {
        const clip = renderer.find(name);
        if (clip?.frame === 150) clip.running = true;
      }
    }
    // Samuel leads Alex to the upper-right corner before the teacher enters.
    const [x, y] = playerPosition;
    const hidingWithSamuel = mode === 'shortCopy' && patrolRequested && x >= 260 && y <= 72;
    const safe = hidingWithSamuel ||
      overlaps(bounds, renderer.bounds(frame === 1804 ? 'safepoint_level2_1' : 'safepoint'));
    const inRange = overlaps(bounds, renderer.bounds(frame === 1804 ? 'hitpoint_level2_1' : 'hitpoint'));
    if (updateVision(safe)) return;
    if (mode === 'pickup' && inRange && !gotTest) {
      gotTest = true;
      renderer.visible('test', false);
      renderer.find('notifier')?.setFrame(2);
    }
    const bar = renderer.find(mode === 'shortCopy' ? 'cheatbar_mini' : 'liquid');
    if (bar && !copied) {
      bar.running = inRange;
      if (bar.frame >= (mode === 'shortCopy' ? 81 : 260)) {
        copied = true;
        renderer.visible('button', false);
        bar.running = true;
      }
    }
    const reachedGoal = mode === 'shortCopy'
      ? overlaps(bounds, renderer.find('teacher')?.find('safepoint')?.bounds())
      : safe && (mode === 'pickup' ? gotTest : copied);
    if (reachedGoal) {
      finishing = true;
      renderer.find('fadeIn').running = true;
    }
  }

  function flushEvents() {
    for (const event of renderer.drainSounds()) {
      if (event.type === 'revealTeacher') {
        teacherVisible = true;
        renderer.visible('teacher_level1_1', true);
      } else if (event.type === 'rootPlay' && frame === samuelClassroom) {
        playing = true;
      } else if (event.type === 'finishClassroom') {
        playing = true;
      } else if (event.type === 'startPatrol') {
        patrolRequested = true;
      } else if (event.type === 'writing') {
        audio.stopSound(1);
        audio.play(1, {loops: 999});
      } else if (event.type === 'stopAllSounds') {
        audio.stop();
      } else if (event.stop) {
        audio.stopSound(event.id);
      } else if (data.audio[event.id]) {
        audio.play(event.id, event);
      }
    }
  }

  function tick() {
    if (document.hidden || pauseMenu.paused) return;
    renderer.advance();
    updateClassroom();
    if (playing) moveTimeline(frame + 1);
    syncSceneEdges();
    syncSideFades();
    flushEvents();
  }

  function resetInput() {
    movementInput.clear();
  }

  // Focused SVG buttons handle their own keyboard activation.
  stage.addEventListener('keydown', event => {
    if (!event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return;
    const button = event.target.closest('[data-symbol]');
    if (!storyButtons.includes(Number(button?.dataset.symbol))) return;
    event.preventDefault();
    event.stopPropagation();
  }, {capture: true});

  window.addEventListener('keydown', event => {
    audio.unlock();
    if (pauseMenu.paused) return;
    if (event.shiftKey && event.code === 'KeyF' && !event.repeat && !finishing) {
      const mode = room();
      const bar = mode === 'copy' || mode === 'shortCopy'
        ? renderer.find(mode === 'shortCopy' ? 'cheatbar_mini' : 'liquid')
        : null;
      if (bar) {
        event.preventDefault();
        bar.setFrame(mode === 'shortCopy' ? 81 : 260);
      }
      return;
    }
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat && !event.defaultPrevented &&
      !event.ctrlKey && !event.altKey && !event.metaKey &&
      (event.target === stage || event.target === document.body) && pendingDistraction()) {
      event.preventDefault();
      startDistraction();
      return;
    }
    if (event.key === ' ' && !event.repeat && !event.defaultPrevented &&
      (event.target === stage || event.target === document.body)) {
      const control = data.scenes[frame].find(record => storyButtons.includes(record.id));
      if (control) {
        event.preventDefault();
        navigate(control.id);
        return;
      }
    }
    if (room() && movementInput.press(event)) event.preventDefault();
  });
  window.addEventListener('keyup', event => movementInput.release(event));
  window.addEventListener('pointerdown', () => audio.unlock(), {capture: true});
  window.addEventListener('blur', resetInput);
  document.addEventListener('visibilitychange', () => {
    resetInput();
    if (document.hidden) audio.pause();
    else if (!pauseMenu.paused) audio.resume();
  });

  populatePasswords(passwordPanel, data.passwords.map(({word}, index) => ({
    label: `${index + 1}.`, password: word,
  })));
  passwordPanel.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const entry = data.passwords.find(item => item.word === passwordInput.value.trim().toLowerCase());
    if (entry) enter(entry.frame, true);
    else status.textContent = 'Select a password first.';
  });
  if (!autosave.resumeFromLink()) enter(title);
  setupGamepad({
    surface: stage.closest('.classroom-layout'), movement: movementInput, pauseMenu,
    goBack: () => {
      if (frame === title) navigate(collectionBack);
      else if ((frame > title && frame < caught) || frame >= credits) enter(title);
      else return false;
      return true;
    },
    canMove: room, advance: () => advanceWithSpace(stage), unlock: () => audio.unlock(),
  });
  runFrameClock(data.fps, tick, () => document.hidden || pauseMenu.paused, stage);
}

loadGame().catch(error => {
  status.textContent = 'Could not load The Classroom 2.';
  console.error(error);
});
