import {createFrameCounter} from './frame-counter.js';

export function runFrameClock(fps, tick, paused, stage) {
  const counter = createFrameCounter(stage, fps);
  const frameTime = 1000 / fps;
  let previous;
  let elapsed = 0;

  document.addEventListener('visibilitychange', () => {
    previous = undefined;
    elapsed = 0;
  });

  function frame(now) {
    const measure = counter.visible;
    const started = measure ? performance.now() : 0;
    let ticks = 0;
    if (paused()) {
      elapsed = 0;
    } else if (previous !== undefined) {
      elapsed += Math.min(100, now - previous);
      while (elapsed >= frameTime) {
        elapsed -= frameTime;
        tick();
        ticks++;
      }
    }
    if (measure) counter.record(now, ticks, performance.now() - started);
    previous = now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
