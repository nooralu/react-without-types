/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  componentStorage,
  supportsComponentStorage,
} from "../ReactFlightServerConfig";

let currentOwner = null;

export function setCurrentOwner(componentInfo) {
  currentOwner = componentInfo;
}

export function resolveOwner() {
  if (currentOwner) return currentOwner;
  if (supportsComponentStorage) {
    const owner = componentStorage.getStore();
    if (owner) return owner;
  }
  return null;
}
