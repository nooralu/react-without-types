/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { preinitModuleForSSR } from "react-client/src/ReactFlightClientConfig";

export function prepareDestinationForModuleImpl(
  moduleLoading,
  // Chunks are double-indexed [..., idx, filenamex, idy, filenamey, ...]
  mod,
  nonce,
) {
  if (typeof moduleLoading === "string") {
    preinitModuleForSSR(moduleLoading + mod, nonce, undefined);
  } else if (moduleLoading !== null) {
    preinitModuleForSSR(
      moduleLoading.prefix + mod,
      nonce,
      moduleLoading.crossOrigin,
    );
  }
}
