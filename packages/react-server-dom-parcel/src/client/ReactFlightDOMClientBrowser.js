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
  injectIntoDevTools,
  processBinaryChunk,
  processStringChunk,
  reportGlobalError,
} from "react-client/src/ReactFlightClient";

import {
  createServerReference as createServerReferenceImpl,
  processReply,
} from "react-client/src/ReactFlightReplyClient";

export { registerServerReference } from "react-client/src/ReactFlightReplyClient";

export { createTemporaryReferenceSet } from "react-client/src/ReactFlightTemporaryReferences";

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

let callServer = null;
export function setServerCallback(fn) {
  callServer = fn;
}

function callCurrentServerCallback(
  id,
  args,
) {
  if (!callServer) {
    throw new Error(
      "No server callback has been registered. Call setServerCallback to register one.",
    );
  }
  return callServer(id, args);
}

export function createServerReference(
  id,
  exportName,
) {
  return createServerReferenceImpl(
    id + "#" + exportName,
    callCurrentServerCallback,
    undefined,
    findSourceMapURL,
    exportName,
  );
}

function createDebugCallbackFromWritableStream(
  debugWritable,
) {
  const textEncoder = new TextEncoder();
  const writer = debugWritable.getWriter();
  return (message) => {
    if (message === "") {
      writer.close();
    } else {
      // Note: It's important that this function doesn't close over the Response object or it can't be GC:ed.
      // Therefore, we can't report errors from this write back to the Response object.
      if (__DEV__) {
        writer.write(textEncoder.encode(message + "\n")).catch(console.error);
      }
    }
  };
}

function createResponseFromOptions(options) {
  const debugChannel = __DEV__ && options && options.debugChannel !== undefined
    ? {
      hasReadable: options.debugChannel.readable !== undefined,
      callback: options.debugChannel.writable !== undefined
        ? createDebugCallbackFromWritableStream(
          options.debugChannel.writable,
        )
        : null,
    }
    : undefined;

  return createResponse(
    null, // bundlerConfig
    null, // serverReferenceConfig
    null, // moduleLoading
    callCurrentServerCallback,
    undefined, // encodeFormAction
    undefined, // nonce
    options && options.temporaryReferences
      ? options.temporaryReferences
      : undefined,
    __DEV__ ? findSourceMapURL : undefined,
    __DEV__ ? (options ? options.replayConsoleLogs !== false : true) : false, // defaults to true
    __DEV__ && options && options.environmentName
      ? options.environmentName
      : undefined,
    debugChannel,
  );
}

function startReadingFromUniversalStream(
  response,
  stream,
  onDone,
) {
  // This is the same as startReadingFromStream except this allows WebSocketStreams which
  // return ArrayBuffer and string chunks instead of Uint8Array chunks. We could potentially
  // always allow streams with variable chunk types.
  const streamState = createStreamState(response, stream);
  const reader = stream.getReader();
  function progress({
    done,
    value,
  }) {
    if (done) {
      return onDone();
    }
    if (value instanceof ArrayBuffer) {
      // WebSockets can produce ArrayBuffer values in ReadableStreams.
      processBinaryChunk(response, streamState, new Uint8Array(value));
    } else if (typeof value === "string") {
      // WebSockets can produce string values in ReadableStreams.
      processStringChunk(response, streamState, value);
    } else {
      processBinaryChunk(response, streamState, value);
    }
    return reader.read().then(progress).catch(error);
  }
  function error(e) {
    reportGlobalError(response, e);
  }
  reader.read().then(progress).catch(error);
}

function startReadingFromStream(
  response,
  stream,
  onDone,
  debugValue,
) {
  const streamState = createStreamState(response, debugValue);
  const reader = stream.getReader();
  function progress({
    done,
    value,
  }) {
    if (done) {
      return onDone();
    }
    const buffer = value;
    processBinaryChunk(response, streamState, buffer);
    return reader.read().then(progress).catch(error);
  }
  function error(e) {
    reportGlobalError(response, e);
  }
  reader.read().then(progress).catch(error);
}

export function createFromReadableStream(
  stream,
  options,
) {
  const response = createResponseFromOptions(options);
  if (
    __DEV__ &&
    options &&
    options.debugChannel &&
    options.debugChannel.readable
  ) {
    let streamDoneCount = 0;
    const handleDone = () => {
      if (++streamDoneCount === 2) {
        close(response);
      }
    };
    startReadingFromUniversalStream(
      response,
      options.debugChannel.readable,
      handleDone,
    );
    startReadingFromStream(response, stream, handleDone, stream);
  } else {
    startReadingFromStream(
      response,
      stream,
      close.bind(null, response),
      stream,
    );
  }
  return getRoot(response);
}

export function createFromFetch(
  promiseForResponse,
  options,
) {
  const response = createResponseFromOptions(options);
  promiseForResponse.then(
    function (r) {
      if (
        __DEV__ &&
        options &&
        options.debugChannel &&
        options.debugChannel.readable
      ) {
        let streamDoneCount = 0;
        const handleDone = () => {
          if (++streamDoneCount === 2) {
            close(response);
          }
        };
        startReadingFromUniversalStream(
          response,
          options.debugChannel.readable,
          handleDone,
        );
        startReadingFromStream(response, r.body, handleDone, r);
      } else {
        startReadingFromStream(
          response,
          r.body,
          close.bind(null, response),
          r,
        );
      }
    },
    function (e) {
      reportGlobalError(response, e);
    },
  );
  return getRoot(response);
}

export function encodeReply(
  value,
  options,
) /* We don't use URLSearchParams yet but maybe */ {
  return new Promise((resolve, reject) => {
    const abort = processReply(
      value,
      "", // formFieldPrefix
      options && options.temporaryReferences
        ? options.temporaryReferences
        : undefined,
      resolve,
      reject,
    );
    if (options && options.signal) {
      const signal = options.signal;
      if (signal.aborted) {
        abort(signal.reason);
      } else {
        const listener = () => {
          abort(signal.reason);
          signal.removeEventListener("abort", listener);
        };
        signal.addEventListener("abort", listener);
      }
    }
  });
}

if (__DEV__) {
  injectIntoDevTools();
}
