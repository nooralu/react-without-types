/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export * from "../ReactFlightServerConfigBundlerCustom";

export * from "../ReactFlightServerConfigDebugNoop";

export * from "../ReactFlightStackConfigV8";
export * from "../ReactServerConsoleConfigServer";

// eslint-disable-next-line no-unused-vars

export const supportsRequestStorage = false;
export const requestStorage = null;

export const supportsComponentStorage = false;
export const componentStorage = null;

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
