/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReactSharedInternals from "shared/ReactSharedInternals";

export function waitForSuspense(fn) {
  const cache = new Map();
  const testDispatcher = {
    getCacheForType(resourceType) {
      let entry = cache.get(resourceType);
      if (entry === undefined) {
        entry = resourceType();
        // TODO: Warn if undefined?
        cache.set(resourceType, entry);
      }
      return entry;
    },
    cacheSignal() {
      return null;
    },
    getOwner() {
      return null;
    },
  };
  // Not using async/await because we don't compile it.
  return new Promise((resolve, reject) => {
    function retry() {
      const prevDispatcher = ReactSharedInternals.A;
      ReactSharedInternals.A = testDispatcher;
      try {
        const result = fn();
        resolve(result);
      } catch (thrownValue) {
        if (typeof thrownValue.then === "function") {
          thrownValue.then(retry, retry);
        } else {
          reject(thrownValue);
        }
      } finally {
        ReactSharedInternals.A = prevDispatcher;
      }
    }
    retry();
  });
}
