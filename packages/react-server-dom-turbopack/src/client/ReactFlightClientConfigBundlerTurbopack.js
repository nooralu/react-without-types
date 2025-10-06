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

import {
  addChunkDebugInfo,
  loadChunk,
} from "react-client/src/ReactFlightClientConfig";

// eslint-disable-next-line no-unused-vars

// The reason this function needs to defined here in this file instead of just
// being exported directly from the TurbopackDestination... file is because the
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
  if (bundlerConfig) {
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
    if (isAsyncImport(metadata)) {
      return [
        resolvedModuleData.id,
        resolvedModuleData.chunks,
        name,
        1, /* async */
      ];
    } else {
      return [resolvedModuleData.id, resolvedModuleData.chunks, name];
    }
  }
  return metadata;
}

export function resolveServerReference(
  bundlerConfig,
  id,
) {
  let name = "";
  let resolvedModuleData = bundlerConfig[id];
  if (resolvedModuleData) {
    // The potentially aliased name.
    name = resolvedModuleData.name;
  } else {
    // We didn't find this specific export name but we might have the * export
    // which contains this name as well.
    // TODO: It's unfortunate that we now have to parse this string. We should
    // probably go back to encoding path and name separately on the client reference.
    const idx = id.lastIndexOf("#");
    if (idx !== -1) {
      name = id.slice(idx + 1);
      resolvedModuleData = bundlerConfig[id.slice(0, idx)];
    }
    if (!resolvedModuleData) {
      throw new Error(
        'Could not find the module "' +
          id +
          '" in the React Server Manifest. ' +
          "This is probably a bug in the React Server Components bundler.",
      );
    }
  }
  if (resolvedModuleData.async) {
    // If the module is marked as async in a Client Reference, we don't actually care.
    // What matters is whether the consumer wants to unwrap it or not.
    // For Server References, it is different because the consumer is completely internal
    // to the bundler. So instead of passing it to each reference we can mark it in the
    // manifest.
    return [
      resolvedModuleData.id,
      resolvedModuleData.chunks,
      name,
      1, /* async */
    ];
  }
  return [resolvedModuleData.id, resolvedModuleData.chunks, name];
}

function requireAsyncModule(id) {
  // We've already loaded all the chunks. We can require the module.
  const promise = __turbopack_require__(id);
  if (typeof promise.then !== "function") {
    // This wasn't a promise after all.
    return null;
  } else if (promise.status === "fulfilled") {
    // This module was already resolved earlier.
    return null;
  } else {
    // Instrument the Promise to stash the result.
    promise.then(
      (value) => {
        const fulfilledThenable = promise;
        fulfilledThenable.status = "fulfilled";
        fulfilledThenable.value = value;
      },
      (reason) => {
        const rejectedThenable = promise;
        rejectedThenable.status = "rejected";
        rejectedThenable.reason = reason;
      },
    );
    return promise;
  }
}

// Turbopack will return cached promises for the same chunk.
// We still want to keep track of which chunks we have already instrumented
// and which chunks have already been loaded until Turbopack returns instrumented
// thenables directly.
const instrumentedChunks = new WeakSet();
const loadedChunks = new WeakSet();

function ignoreReject() {
  // We rely on rejected promises to be handled by another listener.
}
// Start preloading the modules since we might need them soon.
// This function doesn't suspend.
export function preloadModule(
  metadata,
) {
  const chunks = metadata[CHUNKS];
  const promises = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkFilename = chunks[i];
    const thenable = loadChunk(chunkFilename);
    if (!loadedChunks.has(thenable)) {
      promises.push(thenable);
    }

    if (!instrumentedChunks.has(thenable)) {
      // $FlowFixMe[method-unbinding]
      const resolve = loadedChunks.add.bind(loadedChunks, thenable);
      thenable.then(resolve, ignoreReject);
      instrumentedChunks.add(thenable);
    }
  }
  if (isAsyncImport(metadata)) {
    if (promises.length === 0) {
      return requireAsyncModule(metadata[ID]);
    } else {
      return Promise.all(promises).then(() => {
        return requireAsyncModule(metadata[ID]);
      });
    }
  } else if (promises.length > 0) {
    return Promise.all(promises);
  } else {
    return null;
  }
}

// Actually require the module or suspend if it's not yet ready.
// Increase priority if necessary.
export function requireModule(metadata) {
  let moduleExports = __turbopack_require__(metadata[ID]);
  if (isAsyncImport(metadata)) {
    if (typeof moduleExports.then !== "function") {
      // This wasn't a promise after all.
    } else if (moduleExports.status === "fulfilled") {
      // This Promise should've been instrumented by preloadModule.
      moduleExports = moduleExports.value;
    } else {
      throw moduleExports.reason;
    }
  }
  if (metadata[NAME] === "*") {
    // This is a placeholder value that represents that the caller imported this
    // as a CommonJS module as is.
    return moduleExports;
  }
  if (metadata[NAME] === "") {
    // This is a placeholder value that represents that the caller accessed the
    // default property of this if it was an ESM interop module.
    return moduleExports.__esModule ? moduleExports.default : moduleExports;
  }
  return moduleExports[metadata[NAME]];
}

export function getModuleDebugInfo(
  metadata,
) {
  if (!__DEV__) {
    return null;
  }
  const chunks = metadata[CHUNKS];
  const debugInfo = [];
  let i = 0;
  while (i < chunks.length) {
    const chunkFilename = chunks[i++];
    addChunkDebugInfo(debugInfo, chunkFilename);
  }
  return debugInfo;
}
