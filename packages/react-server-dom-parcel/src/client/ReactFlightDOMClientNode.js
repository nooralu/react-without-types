/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  close,
  createResponse,
  createStreamState,
  getRoot,
  processBinaryChunk,
  processStringChunk,
  reportGlobalError,
} from "react-client/src/ReactFlightClient";

export * from "./ReactFlightDOMClientEdge";

function findSourceMapURL(filename, environmentName) {
  const devServer = parcelRequire.meta.devServer;
  if (devServer != null) {
    const qs = new URLSearchParams();
    qs.set("filename", filename);
    qs.set("env", environmentName);
    return devServer + "/__parcel_source_map?" + qs.toString();
  }
  return null;
}

function noServerCall() {
  throw new Error(
    "Server Functions cannot be called during initial render. " +
      "This would create a fetch waterfall. Try to use a Server Component " +
      "to pass data to Client Components instead.",
  );
}

function startReadingFromStream(
  response,
  stream,
  onEnd,
) {
  const streamState = createStreamState(response, stream);

  stream.on("data", (chunk) => {
    if (typeof chunk === "string") {
      processStringChunk(response, streamState, chunk);
    } else {
      processBinaryChunk(response, streamState, chunk);
    }
  });

  stream.on("error", (error) => {
    reportGlobalError(response, error);
  });

  stream.on("end", onEnd);
}

export function createFromNodeStream(
  stream,
  options,
) {
  const debugChannel = __DEV__ && options && options.debugChannel !== undefined
    ? {
      hasReadable: options.debugChannel.readable !== undefined,
      callback: null,
    }
    : undefined;

  const response = createResponse(
    null, // bundlerConfig
    null, // serverReferenceConfig
    null, // moduleLoading
    noServerCall,
    options ? options.encodeFormAction : undefined,
    options && typeof options.nonce === "string" ? options.nonce : undefined,
    undefined, // TODO: If encodeReply is supported, this should support temporaryReferences
    __DEV__ ? findSourceMapURL : undefined,
    __DEV__ && options ? options.replayConsoleLogs === true : false, // defaults to false
    __DEV__ && options && options.environmentName
      ? options.environmentName
      : undefined,
    debugChannel,
  );

  if (__DEV__ && options && options.debugChannel) {
    let streamEndedCount = 0;
    const handleEnd = () => {
      if (++streamEndedCount === 2) {
        close(response);
      }
    };
    startReadingFromStream(response, options.debugChannel, handleEnd);
    startReadingFromStream(response, stream, handleEnd);
  } else {
    startReadingFromStream(response, stream, close.bind(null, response));
  }

  return getRoot(response);
}
