/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export {
  isClientReference,
  isServerReference,
} from "../ReactFlightParcelReferences";

export function getClientReferenceKey(
  reference,
) {
  return reference.$$id + "#" + reference.$$name;
}

export function resolveClientReferenceMetadata(
  config,
  clientReference,
) {
  if (clientReference.$$importMap) {
    return [
      clientReference.$$id,
      clientReference.$$name,
      clientReference.$$bundles,
      clientReference.$$importMap,
    ];
  }

  return [
    clientReference.$$id,
    clientReference.$$name,
    clientReference.$$bundles,
  ];
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
