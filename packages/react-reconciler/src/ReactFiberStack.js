/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const valueStack = [];

let fiberStack;

if (__DEV__) {
  fiberStack = [];
}

let index = -1;

function createCursor(defaultValue) {
  return {
    current: defaultValue,
  };
}

function pop(cursor, fiber) {
  if (index < 0) {
    if (__DEV__) {
      console.error("Unexpected pop.");
    }
    return;
  }

  if (__DEV__) {
    if (fiber !== fiberStack[index]) {
      console.error("Unexpected Fiber popped.");
    }
  }

  cursor.current = valueStack[index];

  valueStack[index] = null;

  if (__DEV__) {
    fiberStack[index] = null;
  }

  index--;
}

function push(cursor, value, fiber) {
  index++;

  valueStack[index] = cursor.current;

  if (__DEV__) {
    fiberStack[index] = fiber;
  }

  cursor.current = value;
}
export { createCursor, pop, push };
