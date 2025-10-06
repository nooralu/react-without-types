/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { default as rendererVersion } from "shared/ReactVersion";
export const rendererPackageName = "react-markup";

export * from "react-markup/src/ReactMarkupLegacyClientStreamConfig.js";
export * from "react-client/src/ReactClientConsoleConfigPlain";

// eslint-disable-line no-unused-vars

export function prepareDestinationForModule(
  moduleLoading,
  nonce,
  metadata,
) {
  throw new Error(
    "renderToHTML should not have emitted Client References. This is a bug in React.",
  );
}

export function resolveClientReference(
  bundlerConfig,
  metadata,
) {
  throw new Error(
    "renderToHTML should not have emitted Client References. This is a bug in React.",
  );
}

export function resolveServerReference(
  config,
  id,
) {
  throw new Error(
    "renderToHTML should not have emitted Server References. This is a bug in React.",
  );
}

export function preloadModule(
  metadata,
) {
  return null;
}

export function requireModule(metadata) {
  throw new Error(
    "renderToHTML should not have emitted Client References. This is a bug in React.",
  );
}

export function getModuleDebugInfo(metadata) {
  throw new Error(
    "renderToHTML should not have emitted Client References. This is a bug in React.",
  );
}

export const usedWithSSR = true;

// eslint-disable-line no-unused-vars

export function dispatchHint(
  code,
  model,
) {
  // Should never happen.
}

export function preinitModuleForSSR(
  href,
  nonce,
  crossOrigin,
) {
  // Should never happen.
}

export function preinitScriptForSSR(
  href,
  nonce,
  crossOrigin,
) {
  // Should never happen.
}
