const deadZone = .35;
const controlSelector = 'button, a[href], [role="button"][tabindex="0"]';

function activate(control) {
  if (control instanceof HTMLElement) control.click();
  else control.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
}

export function setupGamepad({surface, movement, canMove, pauseMenu, goBack, advance, unlock}) {
  if (!navigator.getGamepads) return;
  let confirmHeld;
  let backHeld;
  let startHeld;
  let navigation = 0;
  let nextNavigation = 0;

  surface.addEventListener('pointerdown', () => delete surface.dataset.gamepadNavigation, {capture: true});

  function controls() {
    const scope = pauseMenu?.paused ? surface.querySelector('dialog[open]') : surface;
    return [...scope.querySelectorAll(controlSelector)].filter(control =>
      control.id !== 'pause-game' && !control.matches(':disabled') &&
      !control.closest('[hidden], [inert], [aria-hidden="true"]') &&
      getComputedStyle(control).visibility === 'visible' &&
      control.getBoundingClientRect().width > 0);
  }

  function poll(now) {
    let pad;
    try {
      pad = navigator.getGamepads().find(device => device?.mapping === 'standard');
    } catch (error) {
      if (error.name !== 'SecurityError') throw error;
      movement?.setGamepad();
      return;
    }

    const pressed = index => Boolean(pad?.buttons[index]?.pressed);
    const confirm = pressed(0);
    const back = pressed(1);
    const start = pressed(9);
    const left = pressed(14) || pad?.axes[0] < -deadZone;
    const right = pressed(15) || pad?.axes[0] > deadZone;
    const up = pressed(12) || pad?.axes[1] < -deadZone;
    const down = pressed(13) || pad?.axes[1] > deadZone;
    const active = Boolean(pad) && !document.hidden && document.hasFocus();
    const handledBack = active && back && backHeld === false &&
      (pauseMenu?.paused || goBack?.());
    if (handledBack) {
      unlock?.();
      if (pauseMenu?.paused) pauseMenu.toggle();
    } else if (active && start && startHeld === false && pauseMenu) {
      unlock?.();
      const submitPassword = surface.querySelector('#password-list:not([hidden]) button[type=submit]');
      if (submitPassword && !pauseMenu.paused) submitPassword.click();
      else pauseMenu.toggle();
    }

    const moving = active && !pauseMenu?.paused && canMove?.();
    if (moving) movement.setGamepad(Number(right) - Number(left), Number(down) - Number(up));
    else movement?.setGamepad();

    const direction = active && !moving ? (down || right ? 1 : up || left ? -1 : 0) : 0;
    if (direction && (direction !== navigation || now >= nextNavigation)) {
      const options = controls();
      const index = options.indexOf(document.activeElement);
      const next = index === -1 ? (direction > 0 ? 0 : options.length - 1)
        : (index + direction + options.length) % options.length;
      if (options[next]) {
        surface.dataset.gamepadNavigation = '';
        options[next].focus({preventScroll: true});
      }
      nextNavigation = now + (direction === navigation ? 125 : 300);
    }

    if (active && confirm && confirmHeld === false && !start && !handledBack) {
      unlock?.();
      const options = controls();
      const focused = options.find(control => control === document.activeElement);
      if (focused) activate(focused);
      else if (!moving && options.length) activate(options[0]);
      else if (!pauseMenu?.paused) advance?.();
    }

    navigation = direction;
    confirmHeld = confirm;
    backHeld = back;
    startHeld = start;
    requestAnimationFrame(poll);
  }

  requestAnimationFrame(poll);
}

export function advanceWithSpace(stage) {
  stage.focus({preventScroll: true});
  stage.dispatchEvent(new KeyboardEvent('keydown', {
    key: ' ', code: 'Space', bubbles: true, cancelable: true,
  }));
}
