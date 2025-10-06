/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReactVersion from "shared/ReactVersion";

import {
  abort as abortFizz,
  createRequest as createFizzRequest,
  startFlowing as startFizzFlowing,
  startWork as startFizzWork,
} from "react-server/src/ReactFizzServer";

import {
  createRenderState,
  createResumableState,
  createRootFormatContext,
} from "./ReactFizzConfigMarkup";

export function experimental_renderToHTML(
  children,
  options,
) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const fizzDestination = {
      push(chunk) {
        if (chunk !== null) {
          buffer += chunk;
        } else {
          // null indicates that we finished
          resolve(buffer);
        }
        return true;
      },
      destroy(error) {
        reject(error);
      },
    };
    function handleError(error, errorInfo) {
      // Any error rejects the promise, regardless of where it happened.
      // Unlike other React SSR we don't want to put Suspense boundaries into
      // client rendering mode because there's no client rendering here.
      reject(error);

      const onError = options && options.onError;
      if (onError) {
        onError(error, errorInfo);
      }
    }
    const resumableState = createResumableState(
      options ? options.identifierPrefix : undefined,
      undefined,
    );
    const fizzRequest = createFizzRequest(
      children,
      resumableState,
      createRenderState(
        resumableState,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ),
      createRootFormatContext(),
      Infinity,
      handleError,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    if (options && options.signal) {
      const signal = options.signal;
      if (signal.aborted) {
        abortFizz(fizzRequest, signal.reason);
      } else {
        const listener = () => {
          abortFizz(fizzRequest, signal.reason);
          signal.removeEventListener("abort", listener);
        };
        signal.addEventListener("abort", listener);
      }
    }
    startFizzWork(fizzRequest);
    startFizzFlowing(fizzRequest, fizzDestination);
  });
}

export { ReactVersion as version };
