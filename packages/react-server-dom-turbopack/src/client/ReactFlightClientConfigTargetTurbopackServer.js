/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { preinitScriptForSSR } from "react-client/src/ReactFlightClientConfig";

export function prepareDestinationWithChunks(
  moduleLoading,
  // Chunks are single-indexed filenames
  chunks,
  nonce,
) {
  if (moduleLoading !== null) {
    for (let i = 0; i < chunks.length; i++) {
      preinitScriptForSSR(
        moduleLoading.prefix + chunks[i],
        nonce,
        moduleLoading.crossOrigin,
      );
    }
  }
}
