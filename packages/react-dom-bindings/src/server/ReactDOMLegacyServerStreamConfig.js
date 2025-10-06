/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export function scheduleWork(callback) {
  callback();
}

export function scheduleMicrotask(callback) {
  // While this defies the method name the legacy builds have special
  // overrides that make work scheduling sync. At the moment scheduleMicrotask
  // isn't used by any legacy APIs so this is somewhat academic but if they
  // did in the future we'd probably want to have this be in sync with scheduleWork
  callback();
}

export function flushBuffered(destination) {}

export function beginWriting(destination) {}

export function writeChunk(
  destination,
  chunk,
) {
  writeChunkAndReturn(destination, chunk);
}

export function writeChunkAndReturn(
  destination,
  chunk,
) {
  return destination.push(chunk);
}

export function completeWriting(destination) {}

export function close(destination) {
  destination.push(null);
}

export function stringToChunk(content) {
  return content;
}

export function stringToPrecomputedChunk(content) {
  return content;
}

export function typedArrayToBinaryChunk(
  content,
) {
  throw new Error("Not implemented.");
}

export const byteLengthOfChunk = null;

export function byteLengthOfBinaryChunk(chunk) {
  throw new Error("Not implemented.");
}

export function closeWithError(destination, error) {
  // $FlowFixMe[incompatible-call]: This is an Error object or the destination accepts other types.
  destination.destroy(error);
}

export { createFastHashJS as createFastHash } from "react-server/src/createFastHashJS";

export function readAsDataURL(blob) {
  return blob.arrayBuffer().then((arrayBuffer) => {
    const encoded =
      typeof Buffer === "function" && typeof Buffer.from === "function"
        ? Buffer.from(arrayBuffer).toString("base64")
        : btoa(String.fromCharCode.apply(String, new Uint8Array(arrayBuffer)));
    const mimeType = blob.type || "application/octet-stream";
    return "data:" + mimeType + ";base64," + encoded;
  });
}
