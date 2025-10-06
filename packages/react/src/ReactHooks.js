/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { REACT_CONSUMER_TYPE } from "shared/ReactSymbols";

import ReactSharedInternals from "shared/ReactSharedInternals";

function resolveDispatcher() {
  const dispatcher = ReactSharedInternals.H;
  if (__DEV__) {
    if (dispatcher === null) {
      console.error(
        "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for" +
          " one of the following reasons:\n" +
          "1. You might have mismatching versions of React and the renderer (such as React DOM)\n" +
          "2. You might be breaking the Rules of Hooks\n" +
          "3. You might have more than one copy of React in the same app\n" +
          "See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.",
      );
    }
  }
  // Will result in a null access error if accessed outside render phase. We
  // intentionally don't throw our own error because this is in a hot path.
  // Also helps ensure this is inlined.
  return dispatcher;
}

export function getCacheForType(resourceType) {
  const dispatcher = ReactSharedInternals.A;
  if (!dispatcher) {
    // If there is no dispatcher, then we treat this as not being cached.
    return resourceType();
  }
  return dispatcher.getCacheForType(resourceType);
}

export function useContext(Context) {
  const dispatcher = resolveDispatcher();
  if (__DEV__) {
    if (Context.$$typeof === REACT_CONSUMER_TYPE) {
      console.error(
        "Calling useContext(Context.Consumer) is not supported and will cause bugs. " +
          "Did you mean to call useContext(Context) instead?",
      );
    }
  }
  return dispatcher.useContext(Context);
}

export function useState(
  initialState,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export function useReducer(
  reducer,
  initialArg,
  init,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useReducer(reducer, initialArg, init);
}

export function useRef(initialValue) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useRef(initialValue);
}

export function useEffect(
  create,
  deps,
) {
  if (__DEV__) {
    if (create == null) {
      console.warn(
        "React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?",
      );
    }
  }

  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
}

export function useInsertionEffect(
  create,
  deps,
) {
  if (__DEV__) {
    if (create == null) {
      console.warn(
        "React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?",
      );
    }
  }

  const dispatcher = resolveDispatcher();
  return dispatcher.useInsertionEffect(create, deps);
}

export function useLayoutEffect(
  create,
  deps,
) {
  if (__DEV__) {
    if (create == null) {
      console.warn(
        "React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?",
      );
    }
  }

  const dispatcher = resolveDispatcher();
  return dispatcher.useLayoutEffect(create, deps);
}

export function useCallback(
  callback,
  deps,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useCallback(callback, deps);
}

export function useMemo(
  create,
  deps,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useMemo(create, deps);
}

export function useImperativeHandle(
  ref,
  create,
  deps,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useImperativeHandle(ref, create, deps);
}

export function useDebugValue(
  value,
  formatterFn,
) {
  if (__DEV__) {
    const dispatcher = resolveDispatcher();
    return dispatcher.useDebugValue(value, formatterFn);
  }
}

export function useTransition() {
  const dispatcher = resolveDispatcher();
  return dispatcher.useTransition();
}

export function useDeferredValue(value, initialValue) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useDeferredValue(value, initialValue);
}

export function useId() {
  const dispatcher = resolveDispatcher();
  return dispatcher.useId();
}

export function useSyncExternalStore(
  subscribe,
  getSnapshot,
  getServerSnapshot,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
}

export function useCacheRefresh() {
  const dispatcher = resolveDispatcher();
  // $FlowFixMe[not-a-function] This is unstable, thus optional
  return dispatcher.useCacheRefresh();
}

export function use(usable) {
  const dispatcher = resolveDispatcher();
  return dispatcher.use(usable);
}

export function useMemoCache(size) {
  const dispatcher = resolveDispatcher();
  // $FlowFixMe[not-a-function] This is unstable, thus optional
  return dispatcher.useMemoCache(size);
}

export function useEffectEvent(
  callback,
) {
  const dispatcher = resolveDispatcher();
  // $FlowFixMe[not-a-function] This is unstable, thus optional
  return dispatcher.useEffectEvent(callback);
}

export function useOptimistic(
  passthrough,
  reducer,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useOptimistic(passthrough, reducer);
}

export function useActionState(
  action,
  initialState,
  permalink,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useActionState(action, initialState, permalink);
}
