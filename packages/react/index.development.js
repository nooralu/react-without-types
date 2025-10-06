/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Keep in sync with https://github.com/facebook/flow/blob/main/lib/react.js

// Export all exports so that they're available in tests.
// We can't use export * from in Flow for some reason.
export {
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  __COMPILER_RUNTIME,
  act, // DEV-only
  Activity,
  cache,
  cacheSignal,
  captureOwnerStack, // DEV-only
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
  unstable_getCacheForType,
  unstable_LegacyHidden,
  unstable_Scope,
  unstable_SuspenseList,
  unstable_TracingMarker,
  unstable_useCacheRefresh,
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
