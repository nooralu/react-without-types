/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";
import { createContext } from "react";

// TODO (cache) Remove this cache; it is outdated and will not work with newer APIs like startTransition.

// Cache implementation was forked from the React repo:
// https://github.com/facebook/react/blob/main/packages/react-cache/src/ReactCacheOld.js
//
// This cache is simpler than react-cache in that:
// 1. Individual items don't need to be invalidated.
//    Profiling data is invalidated as a whole.
// 2. We didn't need the added overhead of an LRU cache.
//    The size of this cache is bounded by how many renders were profiled,
//    and it will be fully reset between profiling sessions.

let readContext;
if (typeof React.use === "function") {
  readContext = function (Context) {
    // eslint-disable-next-line react-hooks-published/rules-of-hooks
    return React.use(Context);
  };
} else if (
  typeof React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED ===
    "object"
) {
  const ReactCurrentDispatcher = React
    .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
  readContext = function (Context) {
    const dispatcher = ReactCurrentDispatcher.current;
    if (dispatcher === null) {
      throw new Error(
        "react-cache: read and preload may only be called from within a " +
          "component's render. They are not supported in event handlers or " +
          "lifecycle methods.",
      );
    }
    return dispatcher.readContext(Context);
  };
} else {
  throw new Error("react-cache: Unsupported React version");
}

const CacheContext = createContext(null);

const entries = new Map();
const resourceConfigs = new Map();

function getEntriesForResource(
  resource,
) {
  let entriesForResource = entries.get(
    resource,
  );
  if (entriesForResource === undefined) {
    const config = resourceConfigs.get(resource);
    entriesForResource = config !== undefined && config.useWeakMap
      ? new WeakMap()
      : new Map();
    entries.set(resource, entriesForResource);
  }
  return entriesForResource;
}

function accessResult(
  resource,
  fetch,
  input,
  key,
) {
  const entriesForResource = getEntriesForResource(resource);
  const entry = entriesForResource.get(key);
  if (entry === undefined) {
    const thenable = fetch(input);
    thenable.then(
      (value) => {
        const fulfilledThenable = thenable;
        fulfilledThenable.status = "fulfilled";
        fulfilledThenable.value = value;
      },
      (error) => {
        const rejectedThenable = thenable;
        rejectedThenable.status = "rejected";
        rejectedThenable.reason = error;
      },
    );
    entriesForResource.set(key, thenable);
    return thenable;
  } else {
    return entry;
  }
}

export function createResource(
  fetch,
  hashInput,
  config = {},
) {
  const resource = {
    clear() {
      entries.delete(resource);
    },

    invalidate(key) {
      const entriesForResource = getEntriesForResource(resource);
      entriesForResource.delete(key);
    },

    read(input) {
      // Prevent access outside of render.
      readContext(CacheContext);

      const key = hashInput(input);
      const result = accessResult(resource, fetch, input, key);
      if (typeof React.use === "function") {
        // eslint-disable-next-line react-hooks-published/rules-of-hooks
        return React.use(result);
      }

      switch (result.status) {
        case "fulfilled": {
          const value = result.value;
          return value;
        }
        case "rejected": {
          const error = result.reason;
          throw error;
        }
        default:
          throw result;
      }
    },

    preload(input) {
      // Prevent access outside of render.
      readContext(CacheContext);

      const key = hashInput(input);
      accessResult(resource, fetch, input, key);
    },

    write(key, value) {
      const entriesForResource = getEntriesForResource(resource);

      const fulfilledThenable = Promise.resolve(
        value,
      );
      fulfilledThenable.status = "fulfilled";
      fulfilledThenable.value = value;

      entriesForResource.set(key, fulfilledThenable);
    },
  };

  resourceConfigs.set(resource, config);

  return resource;
}

export function invalidateResources() {
  entries.clear();
}
