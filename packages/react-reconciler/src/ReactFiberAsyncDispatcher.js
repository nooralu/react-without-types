/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readContext } from "./ReactFiberNewContext";
import { CacheContext } from "./ReactFiberCacheComponent";

import { current as currentOwner } from "./ReactCurrentFiber";

function getCacheForType(resourceType) {
  const cache = readContext(CacheContext);
  let cacheForType = cache.data.get(resourceType);
  if (cacheForType === undefined) {
    cacheForType = resourceType();
    cache.data.set(resourceType, cacheForType);
  }
  return cacheForType;
}

function cacheSignal() {
  const cache = readContext(CacheContext);
  return cache.controller.signal;
}

export const DefaultAsyncDispatcher = {
  getCacheForType,
  cacheSignal,
};

if (__DEV__) {
  DefaultAsyncDispatcher.getOwner = () => {
    return currentOwner;
  };
}
