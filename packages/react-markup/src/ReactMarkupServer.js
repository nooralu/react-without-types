/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReactVersion from "shared/ReactVersion";

import ReactSharedInternalsServer from "react-server/src/ReactSharedInternalsServer";
import ReactSharedInternalsClient from "shared/ReactSharedInternals";

import {
  abort as abortFlight,
  createRequest as createFlightRequest,
  startFlowing as startFlightFlowing,
  startWork as startFlightWork,
} from "react-server/src/ReactFlightServer";

import {
  close as closeFlight,
  createResponse as createFlightResponse,
  createStreamState as createFlightStreamState,
  getRoot as getFlightRoot,
  processStringChunk as processFlightStringChunk,
} from "react-client/src/ReactFlightClient";

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

// Thenable<ReactMarkupNodeList>

function noServerCallOrFormAction() {
  throw new Error(
    "renderToHTML should not have emitted Server References. This is a bug in React.",
  );
}

export function experimental_renderToHTML(
  children,
  options,
) {
  return new Promise((resolve, reject) => {
    const flightResponse = createFlightResponse(
      null,
      null,
      null,
      noServerCallOrFormAction,
      noServerCallOrFormAction,
      undefined,
      undefined,
      undefined,
      false,
    );
    const streamState = createFlightStreamState(flightResponse, null);
    const flightDestination = {
      push(chunk) {
        if (chunk !== null) {
          processFlightStringChunk(flightResponse, streamState, chunk);
        } else {
          closeFlight(flightResponse);
        }
        return true;
      },
      destroy(error) {
        abortFizz(fizzRequest, error);
        reject(error);
      },
    };
    let buffer = "";
    const fizzDestination = {
      // $FlowFixMe[missing-local-annot]
      push(chunk) {
        if (chunk !== null) {
          buffer += chunk;
        } else {
          // null indicates that we finished
          resolve(buffer);
        }
        return true;
      },
      // $FlowFixMe[missing-local-annot]
      destroy(error) {
        abortFlight(flightRequest, error);
        reject(error);
      },
    };

    let stashErrorIdx = 1;
    const stashedErrors = new Map();

    function handleFlightError(error) {
      // For Flight errors we don't immediately reject, because they might not matter
      // to the output of the HTML. We stash the error with a digest in case we need
      // to get to the original error from the Fizz render.
      const id = "" + stashErrorIdx++;
      stashedErrors.set(id, error);
      return id;
    }

    function handleError(error, errorInfo) {
      if (typeof error === "object" && error !== null) {
        const id = error.digest;
        // Note that the original error might be `undefined` so we need a has check.
        if (typeof id === "string" && stashedErrors.has(id)) {
          // Get the original error thrown inside Flight.
          error = stashedErrors.get(id);
        }
      }

      // Any error rejects the promise, regardless of where it happened.
      // Unlike other React SSR we don't want to put Suspense boundaries into
      // client rendering mode because there's no client rendering here.
      reject(error);

      const onError = options && options.onError;
      if (onError) {
        if (__DEV__) {
          const prevGetCurrentStackImpl =
            ReactSharedInternalsServer.getCurrentStack;
          // We're inside a "client" callback from Fizz but we only have access to the
          // "server" runtime so to get access to a stack trace within this callback we
          // need to override it to get it from the client runtime.
          ReactSharedInternalsServer.getCurrentStack =
            ReactSharedInternalsClient.getCurrentStack;
          try {
            onError(error, errorInfo);
          } finally {
            ReactSharedInternalsServer.getCurrentStack =
              prevGetCurrentStackImpl;
          }
        } else {
          onError(error, errorInfo);
        }
      }
    }
    const flightRequest = createFlightRequest(
      // $FlowFixMe: This should be a subtype but not everything is typed covariant.
      children,
      null,
      handleFlightError,
      options ? options.identifierPrefix : undefined,
      undefined,
      undefined,
      "Markup",
      undefined,
      false,
    );
    const resumableState = createResumableState(
      options ? options.identifierPrefix : undefined,
      undefined,
    );
    const root = getFlightRoot(flightResponse);
    const fizzRequest = createFizzRequest(
      // $FlowFixMe: Thenables as children are supported.
      root,
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
        abortFlight(flightRequest, signal.reason);
        abortFizz(fizzRequest, signal.reason);
      } else {
        const listener = () => {
          abortFlight(flightRequest, signal.reason);
          abortFizz(fizzRequest, signal.reason);
          signal.removeEventListener("abort", listener);
        };
        signal.addEventListener("abort", listener);
      }
    }
    startFlightWork(flightRequest);
    startFlightFlowing(flightRequest, flightDestination);
    startFizzWork(fizzRequest);
    startFizzFlowing(fizzRequest, fizzDestination);
  });
}

export { ReactVersion as version };
