/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { currentTaskInDEV } from "./ReactFizzCurrentTask";

function getCacheForType(resourceType) {
  throw new Error("Not implemented.");
}

function cacheSignal() {
  throw new Error("Not implemented.");
}

export const DefaultAsyncDispatcher = {
  getCacheForType,
  cacheSignal,
};

if (__DEV__) {
  DefaultAsyncDispatcher.getOwner = () => {
    if (currentTaskInDEV === null) {
      return null;
    }
    return currentTaskInDEV.componentStack;
  };
}
