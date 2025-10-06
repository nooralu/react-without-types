/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  BUNDLES,
  ID,
  IMPORT_MAP,
  NAME,
} from "../shared/ReactFlightImportMetadata";
import { prepareDestinationWithChunks } from "react-client/src/ReactFlightClientConfig";

// eslint-disable-next-line no-unused-vars

export function prepareDestinationForModule(
  moduleLoading,
  nonce,
  metadata,
) {
  prepareDestinationWithChunks(moduleLoading, metadata[BUNDLES], nonce);
}

export function resolveClientReference(
  bundlerConfig,
  metadata,
) {
  // Reference is already resolved during the build.
  return metadata;
}

export function resolveServerReference(
  bundlerConfig,
  ref,
) {
  const idx = ref.lastIndexOf("#");
  const id = ref.slice(0, idx);
  const name = ref.slice(idx + 1);
  const bundles = bundlerConfig[id];
  if (!bundles) {
    throw new Error("Invalid server action: " + ref);
  }
  return [id, name, bundles];
}

export function preloadModule(
  metadata,
) {
  if (metadata[IMPORT_MAP]) {
    parcelRequire.extendImportMap(metadata[IMPORT_MAP]);
  }

  if (metadata[BUNDLES].length === 0) {
    return null;
  }

  return Promise.all(metadata[BUNDLES].map((url) => parcelRequire.load(url)));
}

export function requireModule(metadata) {
  const moduleExports = parcelRequire(metadata[ID]);
  return moduleExports[metadata[NAME]];
}

export function getModuleDebugInfo(
  metadata,
) {
  // TODO
  return null;
}
