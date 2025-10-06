/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReactVersion from "shared/ReactVersion";

import {
  abort,
  createRequest,
  prepareForStartFlowingIfBeforeAllReady,
  resumeRequest,
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

import { textEncoder } from "react-server/src/ReactServerStreamConfigNode";

import { ensureCorrectIsomorphicReactVersion } from "../shared/ensureCorrectIsomorphicReactVersion";
ensureCorrectIsomorphicReactVersion();

function createDrainHandler(destination, request) {
  return () => startFlowing(request, destination);
}

function createCancelHandler(request, reason) {
  return () => {
    stopFlowing(request);
    // eslint-disable-next-line react-internal/prod-error-codes
    abort(request, new Error(reason));
  };
}

function createRequestImpl(children, options) {
  const resumableState = createResumableState(
    options ? options.identifierPrefix : undefined,
    options ? options.unstable_externalRuntimeSrc : undefined,
    options ? options.bootstrapScriptContent : undefined,
    options ? options.bootstrapScripts : undefined,
    options ? options.bootstrapModules : undefined,
  );
  return createRequest(
    children,
    resumableState,
    createRenderState(
      resumableState,
      options ? options.nonce : undefined,
      options ? options.unstable_externalRuntimeSrc : undefined,
      options ? options.importMap : undefined,
      options ? options.onHeaders : undefined,
      options ? options.maxHeadersLength : undefined,
    ),
    createRootFormatContext(options ? options.namespaceURI : undefined),
    options ? options.progressiveChunkSize : undefined,
    options ? options.onError : undefined,
    options ? options.onAllReady : undefined,
    options ? options.onShellReady : undefined,
    options ? options.onShellError : undefined,
    undefined,
    options ? options.onPostpone : undefined,
    options ? options.formState : undefined,
  );
}

function renderToPipeableStream(
  children,
  options,
) {
  const request = createRequestImpl(children, options);
  let hasStartedFlowing = false;
  startWork(request);
  return {
    pipe(destination) {
      if (hasStartedFlowing) {
        throw new Error(
          "React currently only supports piping to one writable stream.",
        );
      }
      hasStartedFlowing = true;
      prepareForStartFlowingIfBeforeAllReady(request);
      startFlowing(request, destination);
      destination.on("drain", createDrainHandler(destination, request));
      destination.on(
        "error",
        createCancelHandler(
          request,
          "The destination stream errored while writing data.",
        ),
      );
      destination.on(
        "close",
        createCancelHandler(request, "The destination stream closed early."),
      );
      return destination;
    },
    abort(reason) {
      abort(request, reason);
    },
  };
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

// TODO: Move to sub-classing ReadableStream.

function renderToReadableStream(
  children,
  options,
) {
  return new Promise((resolve, reject) => {
    let onFatalError;
    let onAllReady;
    const allReady = new Promise((res, rej) => {
      onAllReady = res;
      onFatalError = rej;
    });

    function onShellReady() {
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
      // TODO: Move to sub-classing ReadableStream.
      stream.allReady = allReady;
      resolve(stream);
    }
    function onShellError(error) {
      // If the shell errors the caller of `renderToReadableStream` won't have access to `allReady`.
      // However, `allReady` will be rejected by `onFatalError` as well.
      // So we need to catch the duplicate, uncatchable fatal error in `allReady` to prevent a `UnhandledPromiseRejection`.
      allReady.catch(() => {});
      reject(error);
    }

    const onHeaders = options ? options.onHeaders : undefined;
    let onHeadersImpl;
    if (onHeaders) {
      onHeadersImpl = (headersDescriptor) => {
        onHeaders(new Headers(headersDescriptor));
      };
    }

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
        options ? options.nonce : undefined,
        options ? options.unstable_externalRuntimeSrc : undefined,
        options ? options.importMap : undefined,
        onHeadersImpl,
        options ? options.maxHeadersLength : undefined,
      ),
      createRootFormatContext(options ? options.namespaceURI : undefined),
      options ? options.progressiveChunkSize : undefined,
      options ? options.onError : undefined,
      onAllReady,
      onShellReady,
      onShellError,
      onFatalError,
      options ? options.onPostpone : undefined,
      options ? options.formState : undefined,
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

function resumeRequestImpl(
  children,
  postponedState,
  options,
) {
  return resumeRequest(
    children,
    postponedState,
    resumeRenderState(
      postponedState.resumableState,
      options ? options.nonce : undefined,
    ),
    options ? options.onError : undefined,
    options ? options.onAllReady : undefined,
    options ? options.onShellReady : undefined,
    options ? options.onShellError : undefined,
    undefined,
    options ? options.onPostpone : undefined,
  );
}

function resumeToPipeableStream(
  children,
  postponedState,
  options,
) {
  const request = resumeRequestImpl(children, postponedState, options);
  let hasStartedFlowing = false;
  startWork(request);
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
      destination.on(
        "close",
        createCancelHandler(request, "The destination stream closed early."),
      );
      return destination;
    },
    abort(reason) {
      abort(request, reason);
    },
  };
}

function resume(
  children,
  postponedState,
  options,
) {
  return new Promise((resolve, reject) => {
    let onFatalError;
    let onAllReady;
    const allReady = new Promise((res, rej) => {
      onAllReady = res;
      onFatalError = rej;
    });

    function onShellReady() {
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
      // TODO: Move to sub-classing ReadableStream.
      stream.allReady = allReady;
      resolve(stream);
    }
    function onShellError(error) {
      // If the shell errors the caller of `renderToReadableStream` won't have access to `allReady`.
      // However, `allReady` will be rejected by `onFatalError` as well.
      // So we need to catch the duplicate, uncatchable fatal error in `allReady` to prevent a `UnhandledPromiseRejection`.
      allReady.catch(() => {});
      reject(error);
    }
    const request = resumeRequest(
      children,
      postponedState,
      resumeRenderState(
        postponedState.resumableState,
        options ? options.nonce : undefined,
      ),
      options ? options.onError : undefined,
      onAllReady,
      onShellReady,
      onShellError,
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
  ReactVersion as version,
  renderToPipeableStream,
  renderToReadableStream,
  resume,
  resumeToPipeableStream,
};
