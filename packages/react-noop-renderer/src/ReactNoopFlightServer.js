/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * This is a renderer of React that doesn't have a render target output.
 * It is useful to demonstrate the internals of the reconciler in isolation
 * and for testing semantics of reconciliation separate from the host
 * environment.
 */

import { saveModule } from "react-noop-renderer/flight-modules";

import ReactFlightServer from "react-server/flight";

const textEncoder = new TextEncoder();

const ReactNoopFlightServer = ReactFlightServer({
  scheduleMicrotask(callback) {
    callback();
  },
  scheduleWork(callback) {
    callback();
  },
  beginWriting(destination) {},
  writeChunk(destination, chunk) {
    destination.push(chunk);
  },
  writeChunkAndReturn(destination, chunk) {
    destination.push(chunk);
    return true;
  },
  completeWriting(destination) {},
  close(destination) {},
  closeWithError(destination, error) {},
  flushBuffered(destination) {},
  stringToChunk(content) {
    return textEncoder.encode(content);
  },
  stringToPrecomputedChunk(content) {
    return textEncoder.encode(content);
  },
  isClientReference(reference) {
    return reference.$$typeof === Symbol.for("react.client.reference");
  },
  isServerReference(reference) {
    return reference.$$typeof === Symbol.for("react.server.reference");
  },
  getClientReferenceKey(reference) {
    return reference;
  },
  resolveClientReferenceMetadata(
    config,
    reference,
  ) {
    return saveModule(reference.value);
  },
});

function render(model, options) {
  const destination = [];
  const bundlerConfig = undefined;
  const request = ReactNoopFlightServer.createRequest(
    model,
    bundlerConfig,
    options ? options.onError : undefined,
    options ? options.identifierPrefix : undefined,
    options ? options.onPostpone : undefined,
    undefined,
    __DEV__ && options ? options.environmentName : undefined,
    __DEV__ && options ? options.filterStackFrame : undefined,
    __DEV__ && options && options.debugChannel !== undefined,
  );
  const signal = options ? options.signal : undefined;
  if (signal) {
    if (signal.aborted) {
      ReactNoopFlightServer.abort(request, signal.reason);
    } else {
      const listener = () => {
        ReactNoopFlightServer.abort(request, signal.reason);
        signal.removeEventListener("abort", listener);
      };
      signal.addEventListener("abort", listener);
    }
  }
  if (__DEV__ && options && options.debugChannel !== undefined) {
    options.debugChannel.onMessage = (message) => {
      ReactNoopFlightServer.resolveDebugMessage(request, message);
    };
  }
  ReactNoopFlightServer.startWork(request);
  ReactNoopFlightServer.startFlowing(request, destination);
  return destination;
}

export { render };
