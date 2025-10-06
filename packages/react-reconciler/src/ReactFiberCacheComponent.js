/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { REACT_CONTEXT_TYPE } from "shared/ReactSymbols";

import { popProvider, pushProvider } from "./ReactFiberNewContext";
import * as Scheduler from "scheduler";

// In environments without AbortController (e.g. tests)
// replace it with a lightweight shim that only has the features we use.
const AbortControllerLocal = typeof AbortController !== "undefined"
  ? AbortController
  // $FlowFixMe[incompatible-type]
  // $FlowFixMe[missing-this-annot]
  : function AbortControllerShim() {
    const listeners = [];
    const signal = (this.signal = {
      aborted: false,
      addEventListener: (type, listener) => {
        listeners.push(listener);
      },
    });

    this.abort = () => {
      signal.aborted = true;
      listeners.forEach((listener) => listener());
    };
  };

// Intentionally not named imports because Rollup would
// use dynamic dispatch for CommonJS interop named imports.
const {
  unstable_scheduleCallback: scheduleCallback,
  unstable_NormalPriority: NormalPriority,
} = Scheduler;

export const CacheContext = {
  $$typeof: REACT_CONTEXT_TYPE,
  // We don't use Consumer/Provider for Cache components. So we'll cheat.
  Consumer: (null),
  Provider: (null),
  // We'll initialize these at the root.
  _currentValue: (null),
  _currentValue2: (null),
  _threadCount: 0,
};

if (__DEV__) {
  CacheContext._currentRenderer = null;
  CacheContext._currentRenderer2 = null;
}

// Creates a new empty Cache instance with a ref-count of 0. The caller is responsible
// for retaining the cache once it is in use (retainCache), and releasing the cache
// once it is no longer needed (releaseCache).
export function createCache() {
  return {
    controller: new AbortControllerLocal(),
    data: new Map(),
    refCount: 0,
  };
}

export function retainCache(cache) {
  if (__DEV__) {
    if (cache.controller.signal.aborted) {
      console.warn(
        "A cache instance was retained after it was already freed. " +
          "This likely indicates a bug in React.",
      );
    }
  }
  cache.refCount++;
}

// Cleanup a cache instance, potentially freeing it if there are no more references
export function releaseCache(cache) {
  cache.refCount--;
  if (__DEV__) {
    if (cache.refCount < 0) {
      console.warn(
        "A cache instance was released after it was already freed. " +
          "This likely indicates a bug in React.",
      );
    }
  }
  if (cache.refCount === 0) {
    scheduleCallback(NormalPriority, () => {
      cache.controller.abort();
    });
  }
}

export function pushCacheProvider(workInProgress, cache) {
  pushProvider(workInProgress, CacheContext, cache);
}

export function popCacheProvider(workInProgress, cache) {
  popProvider(CacheContext, workInProgress);
}
