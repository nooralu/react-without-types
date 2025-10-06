/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// eslint-disable-line no-unused-vars

export function createHints() {
  return null;
}

export function createRootFormatContext() {
  return null;
}

export function getChildFormatContext(
  parentContext,
  type,
  props,
) {
  return parentContext;
}

export const supportsRequestStorage = false;
export const requestStorage = null;

export const supportsComponentStorage = false;
export const componentStorage = null;

export * from "../ReactFlightServerConfigDebugNoop";

export * from "../ReactFlightStackConfigV8";
export * from "../ReactServerConsoleConfigPlain";

// eslint-disable-line no-unused-vars
// eslint-disable-line no-unused-vars

const CLIENT_REFERENCE_TAG = Symbol.for("react.client.reference");
const SERVER_REFERENCE_TAG = Symbol.for("react.server.reference");

export function isClientReference(reference) {
  return reference.$$typeof === CLIENT_REFERENCE_TAG;
}

export function isServerReference(reference) {
  return reference.$$typeof === SERVER_REFERENCE_TAG;
}

export function getClientReferenceKey(
  reference,
) {
  throw new Error(
    "Attempted to render a Client Component from renderToHTML. " +
      "This is not supported since it will never hydrate. " +
      "Only render Server Components with renderToHTML.",
  );
}

export function resolveClientReferenceMetadata(
  config,
  clientReference,
) {
  throw new Error(
    "Attempted to render a Client Component from renderToHTML. " +
      "This is not supported since it will never hydrate. " +
      "Only render Server Components with renderToHTML.",
  );
}

export function getServerReferenceId(
  config,
  serverReference,
) {
  throw new Error(
    "Attempted to render a Server Action from renderToHTML. " +
      "This is not supported since it varies by version of the app. " +
      "Use a fixed URL for any forms instead.",
  );
}

export function getServerReferenceBoundArguments(
  config,
  serverReference,
) {
  throw new Error(
    "Attempted to render a Server Action from renderToHTML. " +
      "This is not supported since it varies by version of the app. " +
      "Use a fixed URL for any forms instead.",
  );
}

export function getServerReferenceLocation(
  config,
  serverReference,
) {
  return undefined;
}
