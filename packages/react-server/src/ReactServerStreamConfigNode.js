/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TextEncoder } from "util";
import { createHash } from "crypto";

export function scheduleWork(callback) {
  setImmediate(callback);
}

export const scheduleMicrotask = queueMicrotask;

export function flushBuffered(destination) {
  // If we don't have any more data to send right now.
  // Flush whatever is in the buffer to the wire.
  if (typeof destination.flush === "function") {
    // By convention the Zlib streams provide a flush function for this purpose.
    // For Express, compression middleware adds this method.
    destination.flush();
  }
}

const VIEW_SIZE = 2048;
let currentView = null;
let writtenBytes = 0;
let destinationHasCapacity = true;

export function beginWriting(destination) {
  currentView = new Uint8Array(VIEW_SIZE);
  writtenBytes = 0;
  destinationHasCapacity = true;
}

function writeStringChunk(destination, stringChunk) {
  if (stringChunk.length === 0) {
    return;
  }
  // maximum possible view needed to encode entire string
  if (stringChunk.length * 3 > VIEW_SIZE) {
    if (writtenBytes > 0) {
      writeToDestination(
        destination,
        currentView.subarray(0, writtenBytes),
      );
      currentView = new Uint8Array(VIEW_SIZE);
      writtenBytes = 0;
    }
    // Write the raw string chunk and let the consumer handle the encoding.
    writeToDestination(destination, stringChunk);
    return;
  }

  let target = currentView;
  if (writtenBytes > 0) {
    target = currentView.subarray(writtenBytes);
  }
  const { read, written } = textEncoder.encodeInto(stringChunk, target);
  writtenBytes += written;

  if (read < stringChunk.length) {
    writeToDestination(
      destination,
      currentView.subarray(0, writtenBytes),
    );
    currentView = new Uint8Array(VIEW_SIZE);
    writtenBytes = textEncoder.encodeInto(
      stringChunk.slice(read),
      currentView,
    ).written;
  }

  if (writtenBytes === VIEW_SIZE) {
    writeToDestination(destination, currentView);
    currentView = new Uint8Array(VIEW_SIZE);
    writtenBytes = 0;
  }
}

function writeViewChunk(
  destination,
  chunk,
) {
  if (chunk.byteLength === 0) {
    return;
  }
  if (chunk.byteLength > VIEW_SIZE) {
    // this chunk may overflow a single view which implies it was not
    // one that is cached by the streaming renderer. We will enqueu
    // it directly and expect it is not re-used
    if (writtenBytes > 0) {
      writeToDestination(
        destination,
        currentView.subarray(0, writtenBytes),
      );
      currentView = new Uint8Array(VIEW_SIZE);
      writtenBytes = 0;
    }
    writeToDestination(destination, chunk);
    return;
  }

  let bytesToWrite = chunk;
  const allowableBytes = currentView.length - writtenBytes;
  if (allowableBytes < bytesToWrite.byteLength) {
    // this chunk would overflow the current view. We enqueue a full view
    // and start a new view with the remaining chunk
    if (allowableBytes === 0) {
      // the current view is already full, send it
      writeToDestination(destination, currentView);
    } else {
      // fill up the current view and apply the remaining chunk bytes
      // to a new view.
      currentView.set(
        bytesToWrite.subarray(0, allowableBytes),
        writtenBytes,
      );
      writtenBytes += allowableBytes;
      writeToDestination(destination, currentView);
      bytesToWrite = bytesToWrite.subarray(allowableBytes);
    }
    currentView = new Uint8Array(VIEW_SIZE);
    writtenBytes = 0;
  }
  currentView.set(bytesToWrite, writtenBytes);
  writtenBytes += bytesToWrite.byteLength;

  if (writtenBytes === VIEW_SIZE) {
    writeToDestination(destination, currentView);
    currentView = new Uint8Array(VIEW_SIZE);
    writtenBytes = 0;
  }
}

export function writeChunk(
  destination,
  chunk,
) {
  if (typeof chunk === "string") {
    writeStringChunk(destination, chunk);
  } else {
    writeViewChunk(destination, chunk);
  }
}

function writeToDestination(
  destination,
  view,
) {
  const currentHasCapacity = destination.write(view);
  destinationHasCapacity = destinationHasCapacity && currentHasCapacity;
}

export function writeChunkAndReturn(
  destination,
  chunk,
) {
  writeChunk(destination, chunk);
  return destinationHasCapacity;
}

export function completeWriting(destination) {
  if (currentView && writtenBytes > 0) {
    destination.write(currentView.subarray(0, writtenBytes));
  }
  currentView = null;
  writtenBytes = 0;
  destinationHasCapacity = true;
}

export function close(destination) {
  destination.end();
}

export const textEncoder = new TextEncoder();

export function stringToChunk(content) {
  return content;
}

export function stringToPrecomputedChunk(content) {
  const precomputedChunk = textEncoder.encode(content);

  if (__DEV__) {
    if (precomputedChunk.byteLength > VIEW_SIZE) {
      console.error(
        "precomputed chunks must be smaller than the view size configured for this host. This is a bug in React.",
      );
    }
  }

  return precomputedChunk;
}

export function typedArrayToBinaryChunk(
  content,
) {
  // Convert any non-Uint8Array array to Uint8Array. We could avoid this for Uint8Arrays.
  return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
}

export function byteLengthOfChunk(chunk) {
  return typeof chunk === "string"
    ? Buffer.byteLength(chunk, "utf8")
    : chunk.byteLength;
}

export function byteLengthOfBinaryChunk(chunk) {
  return chunk.byteLength;
}

export function closeWithError(destination, error) {
  // $FlowFixMe[incompatible-call]: This is an Error object or the destination accepts other types.
  destination.destroy(error);
}

export function createFastHash(input) {
  const hash = createHash("md5");
  hash.update(input);
  return hash.digest("hex");
}

export function readAsDataURL(blob) {
  return blob.arrayBuffer().then((arrayBuffer) => {
    const encoded = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = blob.type || "application/octet-stream";
    return "data:" + mimeType + ";base64," + encoded;
  });
}
