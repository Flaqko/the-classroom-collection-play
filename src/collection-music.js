import {setupGamepad} from './gamepad.js?v=controller-highlight';
import {fullscreenDocument, toggleFullscreen, watchFullscreen} from './fullscreen.js';
import {OriginalAudio} from './audio.js';
import {classroomThreeCreditsLoop} from './classroom-3-music.js';

const [track] = classroomThreeCreditsLoop;
const audio = new OriginalAudio({[track]: {file: '43.mp3', stereo: true}}, 'assets/classroom-3/audio/');

window.addEventListener('pointerdown', () => audio.unlock(), {once: true});
window.addEventListener('keydown', () => audio.unlock(), {once: true});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.pause();
  else audio.resume();
});
if (document.hidden) audio.pause();
audio.playLoop(...classroomThreeCreditsLoop);

const surface = document.querySelector('.collection-frame');
const selection = surface.querySelector('.collection');
const settings = surface.querySelector('.collection-settings');
const settingsButton = surface.querySelector('.collection-settings-trigger');
const exitScreen = surface.querySelector('.collection-exit');
const returnButton = exitScreen.querySelector('button');
const fullscreen = settings.querySelector('[data-setting=fullscreen]');
const sound = settings.querySelector('[data-setting=sound]');
const exit = settings.querySelector('[data-setting=exit]');
const status = settings.querySelector('[role=status]');

function toggleSettings() {
  if (!exitScreen.hidden) return;
  if (settings.open) {
    settings.close();
  } else {
    status.hidden = true;
    settings.showModal();
  }
}

function updateSound() {
  sound.textContent = audio.muted ? 'Sound on' : 'Sound off';
  sound.setAttribute('aria-pressed', String(audio.muted));
}

settingsButton.addEventListener('click', toggleSettings);
sound.addEventListener('click', () => {
  audio.mute(!audio.muted);
  try { localStorage.setItem('classroom.sound-muted', String(audio.muted)); }
  catch { /* Sound still changes for the current page. */ }
  updateSound();
});
updateSound();

watchFullscreen(fullscreen);
fullscreen.addEventListener('click', async () => {
  try {
    await toggleFullscreen();
    status.hidden = true;
  } catch {
    status.textContent = fullscreenDocument.fullscreenEnabled
      ? 'Tap or click Fullscreen to switch modes.'
      : 'Fullscreen is unavailable in this browser.';
    status.hidden = false;
  }
});

exit.addEventListener('click', () => {
  settings.close();
  audio.stop();
  selection.hidden = true;
  settingsButton.hidden = true;
  exitScreen.hidden = false;
  returnButton.focus();
  if (fullscreenDocument.fullscreenElement) fullscreenDocument.exitFullscreen().catch(() => {});
  fullscreenDocument.defaultView.close();
});
returnButton.addEventListener('click', () => {
  exitScreen.hidden = true;
  selection.hidden = false;
  settingsButton.hidden = false;
  audio.playLoop(...classroomThreeCreditsLoop);
  selection.querySelector('a').focus();
});

setupGamepad({
  surface,
  pauseMenu: {get paused() { return settings.open; }, toggle: toggleSettings},
  unlock: () => audio.unlock(),
});
