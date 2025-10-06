/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Readable } from "stream";

import { ASYNC_ITERATOR } from "shared/ReactSymbols";

import {
  abort,
  closeDebugChannel,
  createPrerenderRequest,
  createRequest,
  resolveDebugMessage,
  startFlowing,
  startFlowingDebug,
  startWork,
  stopFlowing,
} from "react-server/src/ReactFlightServer";

import {
  close,
  createResponse,
  getRoot,
  reportGlobalError,
  resolveField,
  resolveFile,
  resolveFileChunk,
  resolveFileComplete,
  resolveFileInfo,
} from "react-server/src/ReactFlightReplyServer";

import {
  decodeAction as decodeActionImpl,
  decodeFormState as decodeFormStateImpl,
} from "react-server/src/ReactFlightActionServer";

import {
  preloadModule,
  requireModule,
  resolveServerReference,
} from "../client/ReactFlightClientConfigBundlerParcel";

export {
  createClientReference,
  registerServerReference,
} from "../ReactFlightParcelReferences";

import {
  createStringDecoder,
  readFinalStringChunk,
  readPartialStringChunk,
} from "react-client/src/ReactFlightClientStreamConfigNode";

import { textEncoder } from "react-server/src/ReactServerStreamConfigNode";

export { createTemporaryReferenceSet } from "react-server/src/ReactFlightServerTemporaryReferences";

function createDrainHandler(destination, request) {
  return () => startFlowing(request, destination);
}

function createCancelHandler(request, reason) {
  return () => {
    stopFlowing(request);
    abort(request, new Error(reason));
  };
}

function startReadingFromDebugChannelReadable(
  request,
  stream,
) {
  const stringDecoder = createStringDecoder();
  let lastWasPartial = false;
  let stringBuffer = "";
  function onData(chunk) {
    if (typeof chunk === "string") {
      if (lastWasPartial) {
        stringBuffer += readFinalStringChunk(stringDecoder, new Uint8Array(0));
        lastWasPartial = false;
      }
      stringBuffer += chunk;
    } else {
      const buffer = chunk;
      stringBuffer += readPartialStringChunk(stringDecoder, buffer);
      lastWasPartial = true;
    }
    const messages = stringBuffer.split("\n");
    for (let i = 0; i < messages.length - 1; i++) {
      resolveDebugMessage(request, messages[i]);
    }
    stringBuffer = messages[messages.length - 1];
  }
  function onError(error) {
    abort(
      request,
      new Error("Lost connection to the Debug Channel.", {
        cause: error,
      }),
    );
  }
  function onClose() {
    closeDebugChannel(request);
  }
  if (
    // $FlowFixMe[method-unbinding]
    typeof stream.addEventListener === "function" &&
    // $FlowFixMe[method-unbinding]
    typeof stream.binaryType === "string"
  ) {
    const ws = stream;
    ws.binaryType = "arraybuffer";
    ws.addEventListener("message", (event) => {
      // $FlowFixMe
      onData(event.data);
    });
    ws.addEventListener("error", (event) => {
      // $FlowFixMe
      onError(event.error);
    });
    ws.addEventListener("close", onClose);
  } else {
    const readable = stream;
    readable.on("data", onData);
    readable.on("error", onError);
    readable.on("end", onClose);
  }
}

export function renderToPipeableStream(
  model,
  options,
) {
  const debugChannel = __DEV__ && options ? options.debugChannel : undefined;
  const debugChannelReadable = __DEV__ &&
      debugChannel !== undefined &&
      // $FlowFixMe[method-unbinding]
      (typeof debugChannel.read === "function" ||
        typeof debugChannel.readyState === "number")
    ? debugChannel
    : undefined;
  const debugChannelWritable = __DEV__ && debugChannel !== undefined
    // $FlowFixMe[method-unbinding]
    ? typeof debugChannel.write === "function"
      ? debugChannel
      // $FlowFixMe[method-unbinding]
      : typeof debugChannel.send === "function"
      ? createFakeWritableFromWebSocket(debugChannel)
      : undefined
    : undefined;
  const request = createRequest(
    model,
    null,
    options ? options.onError : undefined,
    options ? options.identifierPrefix : undefined,
    options ? options.onPostpone : undefined,
    options ? options.temporaryReferences : undefined,
    __DEV__ && options ? options.environmentName : undefined,
    __DEV__ && options ? options.filterStackFrame : undefined,
    debugChannel !== undefined,
  );
  let hasStartedFlowing = false;
  startWork(request);
  if (debugChannelWritable !== undefined) {
    startFlowingDebug(request, debugChannelWritable);
  }
  if (debugChannelReadable !== undefined) {
    startReadingFromDebugChannelReadable(request, debugChannelReadable);
  }
  return {
    pipe(destination) {
      if (hasStartedFlowing) {
        throw new Error(
          "React currently only supports piping to one writable stream.",
        );
      }
      hasStartedFlowing = true;
      startFlowing(request, destination);
      destination.on("drain", createDrainHandler(destination, request));
      destination.on(
        "error",
        createCancelHandler(
          request,
          "The destination stream errored while writing data.",
        ),
      );
      // We don't close until the debug channel closes.
      if (!__DEV__ || debugChannelReadable === undefined) {
        destination.on(
          "close",
          createCancelHandler(request, "The destination stream closed early."),
        );
      }
      return destination;
    },
    abort(reason) {
      abort(request, reason);
    },
  };
}

function createFakeWritableFromWebSocket(webSocket) {
  return ({
    write(chunk) {
      webSocket.send(chunk);
      return true;
    },
    end() {
      webSocket.close();
    },
    destroy(reason) {
      if (typeof reason === "object" && reason !== null) {
        reason = reason.message;
      }
      if (typeof reason === "string") {
        webSocket.close(1011, reason);
      } else {
        webSocket.close(1011);
      }
    },
  });
}

function createFakeWritableFromReadableStreamController(
  controller,
) {
  // The current host config expects a Writable so we create
  // a fake writable for now to push into the Readable.
  return ({
    write(chunk) {
      if (typeof chunk === "string") {
        chunk = textEncoder.encode(chunk);
      }
      controller.enqueue(chunk);
      // in web streams there is no backpressure so we can always write more
      return true;
    },
    end() {
      controller.close();
    },
    destroy(error) {
      // $FlowFixMe[method-unbinding]
      if (typeof controller.error === "function") {
        // $FlowFixMe[incompatible-call]: This is an Error object or the destination accepts other types.
        controller.error(error);
      } else {
        controller.close();
      }
    },
  });
}

function startReadingFromDebugChannelReadableStream(
  request,
  stream,
) {
  const reader = stream.getReader();
  const stringDecoder = createStringDecoder();
  let stringBuffer = "";
  function progress({
    done,
    value,
  }) {
    const buffer = value;
    stringBuffer += done
      ? readFinalStringChunk(stringDecoder, new Uint8Array(0))
      : readPartialStringChunk(stringDecoder, buffer);
    const messages = stringBuffer.split("\n");
    for (let i = 0; i < messages.length - 1; i++) {
      resolveDebugMessage(request, messages[i]);
    }
    stringBuffer = messages[messages.length - 1];
    if (done) {
      closeDebugChannel(request);
      return;
    }
    return reader.read().then(progress).catch(error);
  }
  function error(e) {
    abort(
      request,
      new Error("Lost connection to the Debug Channel.", {
        cause: e,
      }),
    );
  }
  reader.read().then(progress).catch(error);
}

export function renderToReadableStream(
  model,
  options,
) {
  const debugChannelReadable = __DEV__ && options && options.debugChannel
    ? options.debugChannel.readable
    : undefined;
  const debugChannelWritable = __DEV__ && options && options.debugChannel
    ? options.debugChannel.writable
    : undefined;
  const request = createRequest(
    model,
    null,
    options ? options.onError : undefined,
    options ? options.identifierPrefix : undefined,
    options ? options.onPostpone : undefined,
    options ? options.temporaryReferences : undefined,
    __DEV__ && options ? options.environmentName : undefined,
    __DEV__ && options ? options.filterStackFrame : undefined,
    debugChannelReadable !== undefined,
  );
  if (options && options.signal) {
    const signal = options.signal;
    if (signal.aborted) {
      abort(request, signal.reason);
    } else {
      const listener = () => {
        abort(request, signal.reason);
        signal.removeEventListener("abort", listener);
      };
      signal.addEventListener("abort", listener);
    }
  }
  if (debugChannelWritable !== undefined) {
    let debugWritable;
    const debugStream = new ReadableStream(
      {
        type: "bytes",
        start: (controller) => {
          debugWritable = createFakeWritableFromReadableStreamController(
            controller,
          );
        },
        pull: (controller) => {
          startFlowingDebug(request, debugWritable);
        },
      },
      // $FlowFixMe[prop-missing] size() methods are not allowed on byte streams.
      { highWaterMark: 0 },
    );
    debugStream.pipeTo(debugChannelWritable);
  }
  if (debugChannelReadable !== undefined) {
    startReadingFromDebugChannelReadableStream(request, debugChannelReadable);
  }
  let writable;
  const stream = new ReadableStream(
    {
      type: "bytes",
      start: (controller) => {
        writable = createFakeWritableFromReadableStreamController(controller);
        startWork(request);
      },
      pull: (controller) => {
        startFlowing(request, writable);
      },
      cancel: (reason) => {
        stopFlowing(request);
        abort(request, reason);
      },
    },
    // $FlowFixMe[prop-missing] size() methods are not allowed on byte streams.
    { highWaterMark: 0 },
  );
  return stream;
}

function createFakeWritableFromNodeReadable(readable) {
  // The current host config expects a Writable so we create
  // a fake writable for now to push into the Readable.
  return ({
    write(chunk) {
      return readable.push(chunk);
    },
    end() {
      readable.push(null);
    },
    destroy(error) {
      readable.destroy(error);
    },
  });
}

export function prerenderToNodeStream(
  model,
  options,
) {
  return new Promise((resolve, reject) => {
    const onFatalError = reject;
    function onAllReady() {
      const readable = new Readable({
        read() {
          startFlowing(request, writable);
        },
      });
      const writable = createFakeWritableFromNodeReadable(readable);
      resolve({ prelude: readable });
    }

    const request = createPrerenderRequest(
      model,
      null,
      onAllReady,
      onFatalError,
      options ? options.onError : undefined,
      options ? options.identifierPrefix : undefined,
      options ? options.onPostpone : undefined,
      options ? options.temporaryReferences : undefined,
      __DEV__ && options ? options.environmentName : undefined,
      __DEV__ && options ? options.filterStackFrame : undefined,
      false,
    );
    if (options && options.signal) {
      const signal = options.signal;
      if (signal.aborted) {
        const reason = signal.reason;
        abort(request, reason);
      } else {
        const listener = () => {
          const reason = signal.reason;
          abort(request, reason);
          signal.removeEventListener("abort", listener);
        };
        signal.addEventListener("abort", listener);
      }
    }
    startWork(request);
  });
}

export function prerender(
  model,
  options,
) {
  return new Promise((resolve, reject) => {
    const onFatalError = reject;
    function onAllReady() {
      let writable;
      const stream = new ReadableStream(
        {
          type: "bytes",
          start: (controller) => {
            writable = createFakeWritableFromReadableStreamController(
              controller,
            );
          },
          pull: (controller) => {
            startFlowing(request, writable);
          },
          cancel: (reason) => {
            stopFlowing(request);
            abort(request, reason);
          },
        },
        // $FlowFixMe[prop-missing] size() methods are not allowed on byte streams.
        { highWaterMark: 0 },
      );
      resolve({ prelude: stream });
    }
    const request = createPrerenderRequest(
      model,
      null,
      onAllReady,
      onFatalError,
      options ? options.onError : undefined,
      options ? options.identifierPrefix : undefined,
      options ? options.onPostpone : undefined,
      options ? options.temporaryReferences : undefined,
      __DEV__ && options ? options.environmentName : undefined,
      __DEV__ && options ? options.filterStackFrame : undefined,
      false,
    );
    if (options && options.signal) {
      const signal = options.signal;
      if (signal.aborted) {
        const reason = signal.reason;
        abort(request, reason);
      } else {
        const listener = () => {
          const reason = signal.reason;
          abort(request, reason);
          signal.removeEventListener("abort", listener);
        };
        signal.addEventListener("abort", listener);
      }
    }
    startWork(request);
  });
}

let serverManifest = {};
export function registerServerActions(manifest) {
  // This function is called by the bundler to register the manifest.
  serverManifest = manifest;
}

export function decodeReplyFromBusboy(
  busboyStream,
  options,
) {
  const response = createResponse(
    serverManifest,
    "",
    options ? options.temporaryReferences : undefined,
  );
  let pendingFiles = 0;
  const queuedFields = [];
  busboyStream.on("field", (name, value) => {
    if (pendingFiles > 0) {
      // Because the 'end' event fires two microtasks after the next 'field'
      // we would resolve files and fields out of order. To handle this properly
      // we queue any fields we receive until the previous file is done.
      queuedFields.push(name, value);
    } else {
      resolveField(response, name, value);
    }
  });
  busboyStream.on("file", (name, value, { filename, encoding, mimeType }) => {
    if (encoding.toLowerCase() === "base64") {
      throw new Error(
        "React doesn't accept base64 encoded file uploads because we don't expect " +
          "form data passed from a browser to ever encode data that way. If that's " +
          "the wrong assumption, we can easily fix it.",
      );
    }
    pendingFiles++;
    const file = resolveFileInfo(response, name, filename, mimeType);
    value.on("data", (chunk) => {
      resolveFileChunk(response, file, chunk);
    });
    value.on("end", () => {
      resolveFileComplete(response, name, file);
      pendingFiles--;
      if (pendingFiles === 0) {
        // Release any queued fields
        for (let i = 0; i < queuedFields.length; i += 2) {
          resolveField(response, queuedFields[i], queuedFields[i + 1]);
        }
        queuedFields.length = 0;
      }
    });
  });
  busboyStream.on("finish", () => {
    close(response);
  });
  busboyStream.on("error", (err) => {
    reportGlobalError(
      response,
      // $FlowFixMe[incompatible-call] types Error and mixed are incompatible
      err,
    );
  });
  return getRoot(response);
}

export function decodeReply(
  body,
  options,
) {
  if (typeof body === "string") {
    const form = new FormData();
    form.append("0", body);
    body = form;
  }
  const response = createResponse(
    serverManifest,
    "",
    options ? options.temporaryReferences : undefined,
    body,
  );
  const root = getRoot(response);
  close(response);
  return root;
}

export function decodeReplyFromAsyncIterable(
  iterable,
  options,
) {
  const iterator = iterable[ASYNC_ITERATOR]();

  const response = createResponse(
    serverManifest,
    "",
    options ? options.temporaryReferences : undefined,
  );

  function progress(
    entry,
  ) {
    if (entry.done) {
      close(response);
    } else {
      const [name, value] = entry.value;
      if (typeof value === "string") {
        resolveField(response, name, value);
      } else {
        resolveFile(response, name, value);
      }
      iterator.next().then(progress, error);
    }
  }
  function error(reason) {
    reportGlobalError(response, reason);
    if (typeof iterator.throw === "function") {
      // The iterator protocol doesn't necessarily include this but a generator do.
      // $FlowFixMe should be able to pass mixed
      iterator.throw(reason).then(error, error);
    }
  }

  iterator.next().then(progress, error);

  return getRoot(response);
}

export function decodeAction(body) {
  return decodeActionImpl(body, serverManifest);
}

export function decodeFormState(
  actionResult,
  body,
) {
  return decodeFormStateImpl(actionResult, body, serverManifest);
}

export function loadServerAction(id) {
  const reference = resolveServerReference(serverManifest, id);
  return Promise.resolve(reference)
    .then(() => preloadModule(reference))
    .then(() => {
      const fn = requireModule(reference);
      if (typeof fn !== "function") {
        throw new Error("Server actions must be functions");
      }
      return fn;
    });
}
