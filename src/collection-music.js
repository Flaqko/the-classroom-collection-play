import {setupGamepad} from './gamepad.js';
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

setupGamepad({surface: document.querySelector('.collection-frame'), unlock: () => audio.unlock()});
