/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Readable, Writable } from "stream";

import ReactVersion from "shared/ReactVersion";

import {
  abort,
  createPrerenderRequest,
  getPostponedState,
  resumeAndPrerenderRequest,
  startFlowing,
  startWork,
  stopFlowing,
} from "react-server/src/ReactFizzServer";

import {
  createRenderState,
  createResumableState,
  createRootFormatContext,
  resumeRenderState,
} from "react-dom-bindings/src/server/ReactFizzConfigDOM";

import { enableHalt, enablePostpone } from "shared/ReactFeatureFlags";

import { textEncoder } from "react-server/src/ReactServerStreamConfigNode";

import { ensureCorrectIsomorphicReactVersion } from "../shared/ensureCorrectIsomorphicReactVersion";
ensureCorrectIsomorphicReactVersion();

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
      // in web streams there is no backpressure so we can alwas write more
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

function createFakeWritableFromReadable(readable) {
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

function prerenderToNodeStream(
  children,
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
      const writable = createFakeWritableFromReadable(readable);

      const result = enablePostpone || enableHalt
        ? {
          postponed: getPostponedState(request),
          prelude: readable,
        }
        : ({
          prelude: readable,
        });
      resolve(result);
    }
    const resumableState = createResumableState(
      options ? options.identifierPrefix : undefined,
      options ? options.unstable_externalRuntimeSrc : undefined,
      options ? options.bootstrapScriptContent : undefined,
      options ? options.bootstrapScripts : undefined,
      options ? options.bootstrapModules : undefined,
    );
    const request = createPrerenderRequest(
      children,
      resumableState,
      createRenderState(
        resumableState,
        undefined, // nonce is not compatible with prerendered bootstrap scripts
        options ? options.unstable_externalRuntimeSrc : undefined,
        options ? options.importMap : undefined,
        options ? options.onHeaders : undefined,
        options ? options.maxHeadersLength : undefined,
      ),
      createRootFormatContext(options ? options.namespaceURI : undefined),
      options ? options.progressiveChunkSize : undefined,
      options ? options.onError : undefined,
      onAllReady,
      undefined,
      undefined,
      onFatalError,
      options ? options.onPostpone : undefined,
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
    startWork(request);
  });
}

function prerender(
  children,
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

      const result = enablePostpone || enableHalt
        ? {
          postponed: getPostponedState(request),
          prelude: stream,
        }
        : ({
          prelude: stream,
        });
      resolve(result);
    }

    const onHeaders = options ? options.onHeaders : undefined;
    let onHeadersImpl;
    if (onHeaders) {
      onHeadersImpl = (headersDescriptor) => {
        onHeaders(new Headers(headersDescriptor));
      };
    }
    const resources = createResumableState(
      options ? options.identifierPrefix : undefined,
      options ? options.unstable_externalRuntimeSrc : undefined,
      options ? options.bootstrapScriptContent : undefined,
      options ? options.bootstrapScripts : undefined,
      options ? options.bootstrapModules : undefined,
    );
    const request = createPrerenderRequest(
      children,
      resources,
      createRenderState(
        resources,
        undefined, // nonce is not compatible with prerendered bootstrap scripts
        options ? options.unstable_externalRuntimeSrc : undefined,
        options ? options.importMap : undefined,
        onHeadersImpl,
        options ? options.maxHeadersLength : undefined,
      ),
      createRootFormatContext(options ? options.namespaceURI : undefined),
      options ? options.progressiveChunkSize : undefined,
      options ? options.onError : undefined,
      onAllReady,
      undefined,
      undefined,
      onFatalError,
      options ? options.onPostpone : undefined,
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
    startWork(request);
  });
}

function resumeAndPrerenderToNodeStream(
  children,
  postponedState,
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
      const writable = createFakeWritableFromReadable(readable);

      const result = {
        postponed: getPostponedState(request),
        prelude: readable,
      };
      resolve(result);
    }
    const request = resumeAndPrerenderRequest(
      children,
      postponedState,
      resumeRenderState(postponedState.resumableState, undefined),
      options ? options.onError : undefined,
      onAllReady,
      undefined,
      undefined,
      onFatalError,
      options ? options.onPostpone : undefined,
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
    startWork(request);
  });
}

function resumeAndPrerender(
  children,
  postponedState,
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

      const result = {
        postponed: getPostponedState(request),
        prelude: stream,
      };
      resolve(result);
    }

    const request = resumeAndPrerenderRequest(
      children,
      postponedState,
      resumeRenderState(postponedState.resumableState, undefined),
      options ? options.onError : undefined,
      onAllReady,
      undefined,
      undefined,
      onFatalError,
      options ? options.onPostpone : undefined,
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
    startWork(request);
  });
}

export {
  prerender,
  prerenderToNodeStream,
  ReactVersion as version,
  resumeAndPrerender,
  resumeAndPrerenderToNodeStream,
};
