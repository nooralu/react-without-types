/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { getCache, resolveRequest } from "../ReactFlightServer";
import { resolveOwner } from "./ReactFlightCurrentOwner";

function resolveCache() {
  const request = resolveRequest();
  if (request) {
    return getCache(request);
  }
  return new Map();
}

export const DefaultAsyncDispatcher = {
  getCacheForType(resourceType) {
    const cache = resolveCache();
    let entry = cache.get(resourceType);
    if (entry === undefined) {
      entry = resourceType();
      // TODO: Warn if undefined?
      cache.set(resourceType, entry);
    }
    return entry;
  },
  cacheSignal() {
    const request = resolveRequest();
    if (request) {
      return request.cacheController.signal;
    }
    return null;
  },
};

if (__DEV__) {
  DefaultAsyncDispatcher.getOwner = resolveOwner;
}
