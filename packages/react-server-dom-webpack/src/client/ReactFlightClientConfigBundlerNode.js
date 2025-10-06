/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  CHUNKS,
  ID,
  isAsyncImport,
  NAME,
} from "../shared/ReactFlightImportMetadata";
import { prepareDestinationWithChunks } from "react-client/src/ReactFlightClientConfig";

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
  prepareDestinationWithChunks(moduleLoading, metadata[CHUNKS], nonce);
}

export function resolveClientReference(
  bundlerConfig,
  metadata,
) {
  const moduleExports = bundlerConfig[metadata[ID]];
  let resolvedModuleData = moduleExports && moduleExports[metadata[NAME]];
  let name;
  if (resolvedModuleData) {
    // The potentially aliased name.
    name = resolvedModuleData.name;
  } else {
    // If we don't have this specific name, we might have the full module.
    resolvedModuleData = moduleExports && moduleExports["*"];
    if (!resolvedModuleData) {
      throw new Error(
        'Could not find the module "' +
          metadata[ID] +
          '" in the React Server Consumer Manifest. ' +
          "This is probably a bug in the React Server Components bundler.",
      );
    }
    name = metadata[NAME];
  }
  return {
    specifier: resolvedModuleData.specifier,
    name: name,
    async: isAsyncImport(metadata),
  };
}

export function resolveServerReference(
  bundlerConfig,
  id,
) {
  const idx = id.lastIndexOf("#");
  const specifier = id.slice(0, idx);
  const name = id.slice(idx + 1);
  return { specifier, name };
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
    let modulePromise = import(metadata.specifier);
    if (metadata.async) {
      // If the module is async, it must have been a CJS module.
      // CJS modules are accessed through the default export in
      // Node.js so we have to get the default export to get the
      // full module exports.
      modulePromise = modulePromise.then(function (value) {
        return value.default;
      });
    }
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
  if (metadata.name === "*") {
    // This is a placeholder value that represents that the caller imported this
    // as a CommonJS module as is.
    return moduleExports;
  }
  if (metadata.name === "") {
    // This is a placeholder value that represents that the caller accessed the
    // default property of this if it was an ESM interop module.
    return moduleExports.default;
  }
  return moduleExports[metadata.name];
}

export function getModuleDebugInfo(metadata) {
  // We don't emit any debug info on the server since we assume the loading
  // of the bundle is insignificant on the server.
  return null;
}
