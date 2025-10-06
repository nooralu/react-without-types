/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Module root path

// Module root path

import { prepareDestinationForModuleImpl } from "react-client/src/ReactFlightClientConfig";

// eslint-disable-next-line no-unused-vars

// The reason this function needs to defined here in this file instead of just
// being exported directly from the WebpackDestination... file is because the
// ClientReferenceMetadata is opaque and we can't unwrap it there.
// This should get inlined and we could also just implement an unwrapping function
// though that risks it getting used in places it shouldn't be. This is unfortunate
// but currently it seems to be the best option we have.
export function prepareDestinationForModule(
  moduleLoading,
  nonce,
  metadata,
) {
  prepareDestinationForModuleImpl(moduleLoading, metadata[0], nonce);
}

export function resolveClientReference(
  bundlerConfig,
  metadata,
) {
  const baseURL = bundlerConfig;
  return {
    specifier: baseURL + metadata[0],
    name: metadata[1],
  };
}

export function resolveServerReference(
  config,
  id,
) {
  const baseURL = config;
  const idx = id.lastIndexOf("#");
  const exportName = id.slice(idx + 1);
  const fullURL = id.slice(0, idx);
  if (!fullURL.startsWith(baseURL)) {
    throw new Error(
      "Attempted to load a Server Reference outside the hosted root.",
    );
  }
  return { specifier: fullURL, name: exportName };
}

const asyncModuleCache = new Map();

export function preloadModule(
  metadata,
) {
  const existingPromise = asyncModuleCache.get(metadata.specifier);
  if (existingPromise) {
    if (existingPromise.status === "fulfilled") {
      return null;
    }
    return existingPromise;
  } else {
    // $FlowFixMe[unsupported-syntax]
    const modulePromise = import(metadata.specifier);
    modulePromise.then(
      (value) => {
        const fulfilledThenable = modulePromise;
        fulfilledThenable.status = "fulfilled";
        fulfilledThenable.value = value;
      },
      (reason) => {
        const rejectedThenable = modulePromise;
        rejectedThenable.status = "rejected";
        rejectedThenable.reason = reason;
      },
    );
    asyncModuleCache.set(metadata.specifier, modulePromise);
    return modulePromise;
  }
}

export function requireModule(metadata) {
  let moduleExports;
  // We assume that preloadModule has been called before, which
  // should have added something to the module cache.
  const promise = asyncModuleCache.get(metadata.specifier);
  if (promise.status === "fulfilled") {
    moduleExports = promise.value;
  } else {
    throw promise.reason;
  }
  return moduleExports[metadata.name];
}

// We cache ReactIOInfo across requests so that inner refreshes can dedupe with outer.
const moduleIOInfoCache = __DEV__ ? new Map() : (null);

export function getModuleDebugInfo(
  metadata,
) {
  if (!__DEV__) {
    return null;
  }
  const filename = metadata.specifier;
  let ioInfo = moduleIOInfoCache.get(filename);
  if (ioInfo === undefined) {
    let href;
    try {
      // $FlowFixMe
      href = new URL(filename, document.baseURI).href;
    } catch (_) {
      href = filename;
    }
    let start = -1;
    let end = -1;
    let byteSize = 0;
    // $FlowFixMe[method-unbinding]
    if (typeof performance.getEntriesByType === "function") {
      // We may be able to collect the start and end time of this resource from Performance Observer.
      const resourceEntries = performance.getEntriesByType("resource");
      for (let i = 0; i < resourceEntries.length; i++) {
        const resourceEntry = resourceEntries[i];
        if (resourceEntry.name === href) {
          start = resourceEntry.startTime;
          end = start + resourceEntry.duration;
          // $FlowFixMe[prop-missing]
          byteSize = (resourceEntry.transferSize) || 0;
        }
      }
    }
    const value = Promise.resolve(href);
    // $FlowFixMe
    value.status = "fulfilled";
    // Is there some more useful representation for the chunk?
    // $FlowFixMe
    value.value = href;
    // Create a fake stack frame that points to the beginning of the chunk. This is
    // probably not source mapped so will link to the compiled source rather than
    // any individual file that goes into the chunks.
    const fakeStack = new Error("react-stack-top-frame");
    if (fakeStack.stack.startsWith("Error: react-stack-top-frame")) {
      // Looks like V8
      fakeStack.stack = "Error: react-stack-top-frame\n" +
        // Add two frames since we always trim one off the top.
        "    at Client Component Bundle (" +
        href +
        ":1:1)\n" +
        "    at Client Component Bundle (" +
        href +
        ":1:1)";
    } else {
      // Looks like Firefox or Safari.
      // Add two frames since we always trim one off the top.
      fakeStack.stack = "Client Component Bundle@" +
        href +
        ":1:1\n" +
        "Client Component Bundle@" +
        href +
        ":1:1";
    }
    ioInfo = {
      name: "script",
      start: start,
      end: end,
      value: value,
      debugStack: fakeStack,
    };
    if (byteSize > 0) {
      // $FlowFixMe[cannot-write]
      ioInfo.byteSize = byteSize;
    }
    moduleIOInfoCache.set(filename, ioInfo);
  }
  // We could dedupe the async info too but conceptually each request is its own await.
  const asyncInfo = {
    awaited: ioInfo,
  };
  return [asyncInfo];
}
