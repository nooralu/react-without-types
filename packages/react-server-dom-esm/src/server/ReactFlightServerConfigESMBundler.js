/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// base URL on the file system

export {
  isClientReference,
  isServerReference,
} from "../ReactFlightESMReferences";

export function getClientReferenceKey(
  reference,
) {
  return reference.$$id;
}

export function resolveClientReferenceMetadata(
  config,
  clientReference,
) {
  const baseURL = config;
  const id = clientReference.$$id;
  const idx = id.lastIndexOf("#");
  const exportName = id.slice(idx + 1);
  const fullURL = id.slice(0, idx);
  if (!fullURL.startsWith(baseURL)) {
    throw new Error(
      "Attempted to load a Client Module outside the hosted root.",
    );
  }
  // Relative URL
  const modulePath = fullURL.slice(baseURL.length);
  return [modulePath, exportName];
}

export function getServerReferenceId(
  config,
  serverReference,
) {
  return serverReference.$$id;
}

export function getServerReferenceBoundArguments(
  config,
  serverReference,
) {
  return serverReference.$$bound;
}

export function getServerReferenceLocation(
  config,
  serverReference,
) {
  return serverReference.$$location;
}
