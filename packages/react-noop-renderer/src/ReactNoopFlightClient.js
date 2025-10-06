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

import { readModule } from "react-noop-renderer/flight-modules";

import ReactFlightClient from "react-client/flight";

const decoderOptions = { stream: true };

const {
  createResponse,
  createStreamState,
  processBinaryChunk,
  getRoot,
  close,
} = ReactFlightClient({
  createStringDecoder() {
    return new TextDecoder();
  },
  readPartialStringChunk(decoder, buffer) {
    return decoder.decode(buffer, decoderOptions);
  },
  readFinalStringChunk(decoder, buffer) {
    return decoder.decode(buffer);
  },
  resolveClientReference(bundlerConfig, idx) {
    return idx;
  },
  prepareDestinationForModule(moduleLoading, metadata) {},
  preloadModule(idx) {},
  requireModule(idx) {
    return readModule(idx);
  },
  parseModel(response, json) {
    return JSON.parse(json, response._fromJSON);
  },
  bindToConsole(methodName, args, badgeName) {
    return Function.prototype.bind.apply(
      // eslint-disable-next-line react-internal/no-production-logging
      console[methodName],
      [console].concat(args),
    );
  },
});

function read(source, options) {
  const response = createResponse(
    source,
    null,
    null,
    undefined,
    undefined,
    undefined,
    undefined,
    options !== undefined ? options.findSourceMapURL : undefined,
    true,
    undefined,
    __DEV__ && options !== undefined && options.debugChannel !== undefined
      ? options.debugChannel.onMessage
      : undefined,
  );
  const streamState = createStreamState(response, source);
  for (let i = 0; i < source.length; i++) {
    processBinaryChunk(response, streamState, source[i], 0);
  }
  if (options !== undefined && options.close) {
    close(response);
  }
  return getRoot(response);
}

export { read };
