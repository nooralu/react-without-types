/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { default as rendererVersion } from "shared/ReactVersion";
export const rendererPackageName = "react-server-dom-bun";

export * from "react-client/src/ReactFlightClientStreamConfigWeb";
export * from "react-client/src/ReactClientConsoleConfigPlain";
export * from "react-dom-bindings/src/shared/ReactFlightClientConfigDOM";

// eslint-disable-line no-unused-vars
export const resolveClientReference = null;
export const resolveServerReference = null;
export const preloadModule = null;
export const requireModule = null;
export const getModuleDebugInfo = null;
export const prepareDestinationForModule = null;
export const usedWithSSR = true;
