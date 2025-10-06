/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { getStackByFiberInDevAndProd } from "./ReactFiberComponentStack";

const CapturedStacks = new WeakMap();

export function createCapturedValueAtFiber(
  value,
  source,
) {
  // If the value is an error, call this function immediately after it is thrown
  // so the stack is accurate.
  if (typeof value === "object" && value !== null) {
    const existing = CapturedStacks.get(value);
    if (existing !== undefined) {
      return existing;
    }
    const captured = {
      value,
      source,
      stack: getStackByFiberInDevAndProd(source),
    };
    CapturedStacks.set(value, captured);
    return captured;
  } else {
    return {
      value,
      source,
      stack: getStackByFiberInDevAndProd(source),
    };
  }
}

export function createCapturedValueFromError(
  value,
  stack,
) {
  const captured = {
    value,
    source: null,
    stack: stack,
  };
  if (typeof stack === "string") {
    CapturedStacks.set(value, captured);
  }
  return captured;
}
