/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  REACT_CONTEXT_TYPE,
  REACT_MEMO_CACHE_SENTINEL,
} from "shared/ReactSymbols";
import { createThenableState, trackUsedThenable } from "./ReactFlightThenable";
import { isClientReference } from "./ReactFlightServerConfig";
import { enableUseEffectEventHook } from "shared/ReactFeatureFlags";

let currentRequest = null;
let thenableIndexCounter = 0;
let thenableState = null;
let currentComponentDebugInfo = null;

export function prepareToUseHooksForRequest(request) {
  currentRequest = request;
}

export function resetHooksForRequest() {
  currentRequest = null;
}

export function prepareToUseHooksForComponent(
  prevThenableState,
  componentDebugInfo,
) {
  thenableIndexCounter = 0;
  thenableState = prevThenableState;
  if (__DEV__) {
    currentComponentDebugInfo = componentDebugInfo;
  }
}

export function getThenableStateAfterSuspending() {
  // If you use() to Suspend this should always exist but if you throw a Promise instead,
  // which is not really supported anymore, it will be empty. We use the empty set as a
  // marker to know if this was a replay of the same component or first attempt.
  const state = thenableState || createThenableState();
  if (__DEV__) {
    // This is a hack but we stash the debug info here so that we don't need a completely
    // different data structure just for this in DEV. Not too happy about it.
    state._componentDebugInfo = currentComponentDebugInfo;
    currentComponentDebugInfo = null;
  }
  thenableState = null;
  return state;
}

export function getTrackedThenablesAfterRendering() {
  return thenableState;
}

export const HooksDispatcher = {
  readContext: unsupportedContext,

  use,
  useCallback(callback) {
    return callback;
  },
  useContext: unsupportedContext,
  useEffect: unsupportedHook,
  useImperativeHandle: unsupportedHook,
  useLayoutEffect: unsupportedHook,
  useInsertionEffect: unsupportedHook,
  useMemo(nextCreate) {
    return nextCreate();
  },
  useReducer: unsupportedHook,
  useRef: unsupportedHook,
  useState: unsupportedHook,
  useDebugValue() {},
  useDeferredValue: unsupportedHook,
  useTransition: unsupportedHook,
  useSyncExternalStore: unsupportedHook,
  useId,
  useHostTransitionStatus: unsupportedHook,
  useFormState: unsupportedHook,
  useActionState: unsupportedHook,
  useOptimistic: unsupportedHook,
  useMemoCache(size) {
    const data = new Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = REACT_MEMO_CACHE_SENTINEL;
    }
    return data;
  },
  useCacheRefresh() {
    return unsupportedRefresh;
  },
};
if (enableUseEffectEventHook) {
  HooksDispatcher.useEffectEvent = unsupportedHook;
}

function unsupportedHook() {
  throw new Error("This Hook is not supported in Server Components.");
}

function unsupportedRefresh() {
  throw new Error(
    "Refreshing the cache is not supported in Server Components.",
  );
}

function unsupportedContext() {
  throw new Error("Cannot read a Client Context from a Server Component.");
}

function useId() {
  if (currentRequest === null) {
    throw new Error("useId can only be used while React is rendering");
  }
  const id = currentRequest.identifierCount++;
  // use 'S' for Flight components to distinguish from 'R' and 'r' in Fizz/Client
  return "_" + currentRequest.identifierPrefix + "S_" + id.toString(32) + "_";
}

function use(usable) {
  if (
    (usable !== null && typeof usable === "object") ||
    typeof usable === "function"
  ) {
    // $FlowFixMe[method-unbinding]
    if (typeof usable.then === "function") {
      // This is a thenable.
      const thenable = usable;

      // Track the position of the thenable within this fiber.
      const index = thenableIndexCounter;
      thenableIndexCounter += 1;

      if (thenableState === null) {
        thenableState = createThenableState();
      }
      return trackUsedThenable(thenableState, thenable, index);
    } else if (usable.$$typeof === REACT_CONTEXT_TYPE) {
      unsupportedContext();
    }
  }

  if (isClientReference(usable)) {
    if (usable.value != null && usable.value.$$typeof === REACT_CONTEXT_TYPE) {
      // Show a more specific message since it's a common mistake.
      throw new Error("Cannot read a Client Context from a Server Component.");
    } else {
      throw new Error("Cannot use() an already resolved Client Reference.");
    }
  } else {
    throw new Error(
      // eslint-disable-next-line react-internal/safe-string-coercion
      "An unsupported type was passed to use(): " + String(usable),
    );
  }
}
