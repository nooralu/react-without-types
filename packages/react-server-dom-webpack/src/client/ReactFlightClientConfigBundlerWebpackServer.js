/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export function loadChunk(chunkId, filename) {
  return __webpack_chunk_load__(chunkId);
}

export function addChunkDebugInfo(
  target,
  chunkId,
  filename,
) {
  // We don't emit any debug info on the server since we assume the loading
  // of the bundle is insignificant on the server.
}
