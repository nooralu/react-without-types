/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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

import { ensureCorrectIsomorphicReactVersion } from "../shared/ensureCorrectIsomorphicReactVersion";
ensureCorrectIsomorphicReactVersion();

function prerender(
  children,
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

function resumeAndPrerender(
  children,
  postponedState,
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

export { prerender, ReactVersion as version, resumeAndPrerender };
