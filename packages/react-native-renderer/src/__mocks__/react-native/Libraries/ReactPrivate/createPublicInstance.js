/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */

export default function createPublicInstance(
  tag,
  viewConfig,
  internalInstanceHandle,
  rootPublicInstance,
) {
  return {
    __nativeTag: tag,
    __internalInstanceHandle: internalInstanceHandle,
    __rootPublicInstance: rootPublicInstance,
  };
}
