const movementKeys = new Map([
  ['ArrowUp', 'up'], ['w', 'up'],
  ['ArrowDown', 'down'], ['s', 'down'],
  ['ArrowLeft', 'left'], ['a', 'left'],
  ['ArrowRight', 'right'], ['d', 'right'],
]);

function keyName(event) {
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

export function createMovementInput() {
  const held = new Set();
  const directions = {};
  let gamepadX = 0;
  let gamepadY = 0;

  function syncDirections() {
    directions.left = gamepadX < 0;
    directions.right = gamepadX > 0;
    directions.up = gamepadY < 0;
    directions.down = gamepadY > 0;
    for (const key of held) directions[movementKeys.get(key)] = true;
  }

  return {
    directions,
    press(event) {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return false;
      const key = keyName(event);
      const direction = movementKeys.get(key);
      if (!direction) return false;
      held.add(key);
      syncDirections();
      return true;
    },
    release(event) {
      const key = keyName(event);
      if (!held.delete(key)) return false;
      syncDirections();
      return true;
    },
    setGamepad(x = 0, y = 0) {
      if (x === gamepadX && y === gamepadY) return;
      gamepadX = x;
      gamepadY = y;
      syncDirections();
    },
    clear() {
      held.clear();
      gamepadX = gamepadY = 0;
      syncDirections();
    },
  };
}
