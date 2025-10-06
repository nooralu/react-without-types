/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  abort,
  createRequest,
  performWork,
  startFlowing,
  startWork,
} from "react-server/src/ReactFizzServer";

import {
  createRenderState,
  createResumableState,
  createRootFormatContext,
} from "react-server/src/ReactFizzConfig";

function renderToStream(children, options) {
  const destination = {
    buffer: "",
    done: false,
    fatal: false,
    error: null,
  };
  const resumableState = createResumableState(
    options ? options.identifierPrefix : undefined,
    options ? options.unstable_externalRuntimeSrc : undefined,
    options ? options.bootstrapScriptContent : undefined,
    options ? options.bootstrapScripts : undefined,
    options ? options.bootstrapModules : undefined,
  );
  const request = createRequest(
    children,
    resumableState,
    createRenderState(
      resumableState,
      undefined,
      options ? options.unstable_externalRuntimeSrc : undefined,
    ),
    createRootFormatContext(undefined),
    options ? options.progressiveChunkSize : undefined,
    options.onError,
    undefined,
    undefined,
  );
  startWork(request);
  if (destination.fatal) {
    throw destination.error;
  }
  return {
    destination,
    request,
  };
}

function abortStream(stream, reason) {
  abort(stream.request, reason);
}

function renderNextChunk(stream) {
  const { request, destination } = stream;
  performWork(request);
  startFlowing(request, destination);
  if (destination.fatal) {
    throw destination.error;
  }
  const chunk = destination.buffer;
  destination.buffer = "";
  return chunk;
}

function hasFinished(stream) {
  return stream.destination.done;
}

function debug(stream) {
  // convert to any to silence flow errors from opaque type
  const request = stream.request;
  return {
    pendingRootTasks: request.pendingRootTasks,
    clientRenderedBoundaries: request.clientRenderedBoundaries.length,
    completedBoundaries: request.completedBoundaries.length,
    partialBoundaries: request.partialBoundaries.length,
    allPendingTasks: request.allPendingTasks,
    pingedTasks: request.pingedTasks.length,
  };
}

export { abortStream, debug, hasFinished, renderNextChunk, renderToStream };
