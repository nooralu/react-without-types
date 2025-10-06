/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { preinitScriptForSSR } from "react-client/src/ReactFlightClientConfig";

export function prepareDestinationWithChunks(
  moduleLoading,
  // Chunks are double-indexed [..., idx, filenamex, idy, filenamey, ...]
  chunks,
  nonce,
) {
  if (moduleLoading !== null) {
    for (let i = 1; i < chunks.length; i += 2) {
      preinitScriptForSSR(
        moduleLoading.prefix + chunks[i],
        nonce,
        moduleLoading.crossOrigin,
      );
    }
  }
}
