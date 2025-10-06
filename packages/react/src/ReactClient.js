/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReactVersion from "shared/ReactVersion";
import {
  REACT_ACTIVITY_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_LEGACY_HIDDEN_TYPE,
  REACT_PROFILER_TYPE,
  REACT_SCOPE_TYPE,
  REACT_STRICT_MODE_TYPE,
  REACT_SUSPENSE_LIST_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_TRACING_MARKER_TYPE,
  REACT_VIEW_TRANSITION_TYPE,
} from "shared/ReactSymbols";

import { Component, PureComponent } from "./ReactBaseClasses";
import { createRef } from "./ReactCreateRef";
import { count, forEach, map, only, toArray } from "./ReactChildren";
import {
  cloneElement,
  createElement,
  isValidElement,
} from "./jsx/ReactJSXElement";
import { createContext } from "./ReactContext";
import { lazy } from "./ReactLazy";
import { forwardRef } from "./ReactForwardRef";
import { memo } from "./ReactMemo";
import { cache, cacheSignal } from "./ReactCacheClient";
import { postpone } from "./ReactPostpone";
import {
  getCacheForType,
  use,
  useActionState,
  useCacheRefresh,
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
} from "./ReactHooks";
import ReactSharedInternals from "./ReactSharedInternalsClient";
import {
  startGestureTransition,
  startTransition,
} from "./ReactStartTransition";
import { addTransitionType } from "./ReactTransitionType";
import { act } from "./ReactAct";
import { captureOwnerStack } from "./ReactOwnerStack";
import * as ReactCompilerRuntime from "./ReactCompilerRuntime";

const Children = {
  map,
  forEach,
  count,
  toArray,
  only,
};

export {
  act,
  addTransitionType as unstable_addTransitionType,
  cache,
  cacheSignal,
  captureOwnerStack,
  Children,
  cloneElement,
  Component,
  createContext,
  createElement,
  createRef,
  forwardRef,
  getCacheForType as unstable_getCacheForType,
  isValidElement,
  lazy,
  memo,
  postpone as unstable_postpone,
  PureComponent,
  REACT_ACTIVITY_TYPE as Activity,
  REACT_FRAGMENT_TYPE as Fragment,
  REACT_LEGACY_HIDDEN_TYPE as unstable_LegacyHidden,
  REACT_PROFILER_TYPE as Profiler,
  // enableScopeAPI
  REACT_SCOPE_TYPE as unstable_Scope,
  REACT_STRICT_MODE_TYPE as StrictMode,
  REACT_SUSPENSE_LIST_TYPE as unstable_SuspenseList,
  REACT_SUSPENSE_TYPE as Suspense,
  // enableTransitionTracing
  REACT_TRACING_MARKER_TYPE as unstable_TracingMarker,
  // enableViewTransition
  REACT_VIEW_TRANSITION_TYPE as unstable_ViewTransition,
  ReactCompilerRuntime as __COMPILER_RUNTIME,
  ReactSharedInternals
    as __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  ReactVersion as version,
  // enableGestureTransition
  startGestureTransition as unstable_startGestureTransition,
  startTransition,
  use,
  useActionState,
  useCacheRefresh as unstable_useCacheRefresh,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  // DEV-only
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
  // Concurrent Mode
  useTransition,
};
