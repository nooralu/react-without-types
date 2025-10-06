/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Exported for runtimes that don't support Promise instrumentation for async debugging.
export function initAsyncDebugInfo() {}
export function markAsyncSequenceRootTask() {}
export function getCurrentAsyncSequence() {
  return null;
}
export function getAsyncSequenceFromPromise(
  promise,
) {
  return null;
}
