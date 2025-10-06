/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  preloadModule,
  requireModule,
  resolveServerReference,
} from "../client/ReactFlightClientConfigBundlerParcel";

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
} from "react-server/src/ReactFlightReplyServer";

import {
  decodeAction as decodeActionImpl,
  decodeFormState as decodeFormStateImpl,
} from "react-server/src/ReactFlightActionServer";

export {
  createClientReference,
  registerServerReference,
} from "../ReactFlightParcelReferences";

import {
  createStringDecoder,
  readFinalStringChunk,
  readPartialStringChunk,
} from "react-client/src/ReactFlightClientStreamConfigWeb";

export { createTemporaryReferenceSet } from "react-server/src/ReactFlightServerTemporaryReferences";

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
    const debugStream = new ReadableStream(
      {
        type: "bytes",
        pull: (controller) => {
          startFlowingDebug(request, controller);
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
  const stream = new ReadableStream(
    {
      type: "bytes",
      start: (controller) => {
        startWork(request);
      },
      pull: (controller) => {
        startFlowing(request, controller);
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

export function prerender(
  model,
  options,
) {
  return new Promise((resolve, reject) => {
    const onFatalError = reject;
    function onAllReady() {
      const stream = new ReadableStream(
        {
          type: "bytes",
          pull: (controller) => {
            startFlowing(request, controller);
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
