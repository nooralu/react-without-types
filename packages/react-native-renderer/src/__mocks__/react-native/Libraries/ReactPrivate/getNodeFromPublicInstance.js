/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */

import { getNodeFromInternalInstanceHandle } from "../../../../ReactNativePublicCompat";

export default function getNodeFromPublicInstance(
  publicInstance,
) {
  return getNodeFromInternalInstanceHandle(
    publicInstance.__internalInstanceHandle,
  );
}
