/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export {
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  __COMPILER_RUNTIME,
  Activity,
  Activity as unstable_Activity,
  cache,
  cacheSignal,
  Children,
  cloneElement,
  Component,
  createContext,
  createElement,
  createRef,
  forwardRef,
  Fragment,
  isValidElement,
  lazy,
  memo,
  Profiler,
  PureComponent,
  startTransition,
  StrictMode,
  Suspense,
  unstable_addTransitionType,
  unstable_getCacheForType,
  unstable_postpone,
  unstable_startGestureTransition,
  unstable_SuspenseList,
  unstable_useCacheRefresh,
  unstable_ViewTransition,
  use,
  useActionState,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
} from "./src/ReactClient";

import { useOptimistic } from "./src/ReactClient";

export function experimental_useOptimistic(
  passthrough,
  reducer,
) {
  if (__DEV__) {
    console.error(
      "useOptimistic is now in canary. Remove the experimental_ prefix. " +
        "The prefixed alias will be removed in an upcoming release.",
    );
  }
  return useOptimistic(passthrough, reducer);
}
