/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { default as __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE } from "./ReactSharedInternalsServer";

import { count, forEach, map, only, toArray } from "./ReactChildren";
import {
  REACT_ACTIVITY_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_PROFILER_TYPE,
  REACT_STRICT_MODE_TYPE,
  REACT_SUSPENSE_LIST_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_VIEW_TRANSITION_TYPE,
} from "shared/ReactSymbols";
import {
  cloneElement,
  createElement,
  isValidElement,
} from "./jsx/ReactJSXElement";
import { createRef } from "./ReactCreateRef";
import {
  getCacheForType,
  use,
  useCallback,
  useDebugValue,
  useId,
  useMemo,
} from "./ReactHooks";
import { forwardRef } from "./ReactForwardRef";
import { lazy } from "./ReactLazy";
import { memo } from "./ReactMemo";
import { cache, cacheSignal } from "./ReactCacheServer";
import { startTransition } from "./ReactStartTransition";
import { postpone } from "./ReactPostpone";
import { captureOwnerStack } from "./ReactOwnerStack";
import version from "shared/ReactVersion";

const Children = {
  map,
  forEach,
  count,
  toArray,
  only,
};

// These are server-only
export {
  taintObjectReference as experimental_taintObjectReference,
  taintUniqueValue as experimental_taintUniqueValue,
} from "./ReactTaint";

export {
  cache,
  cacheSignal,
  captureOwnerStack, // DEV-only
  Children,
  cloneElement,
  createElement,
  createRef,
  forwardRef,
  getCacheForType as unstable_getCacheForType,
  isValidElement,
  lazy,
  memo,
  postpone as unstable_postpone,
  REACT_ACTIVITY_TYPE as unstable_Activity,
  REACT_FRAGMENT_TYPE as Fragment,
  REACT_PROFILER_TYPE as Profiler,
  REACT_STRICT_MODE_TYPE as StrictMode,
  // Experimental
  REACT_SUSPENSE_LIST_TYPE as unstable_SuspenseList,
  REACT_SUSPENSE_TYPE as Suspense,
  REACT_VIEW_TRANSITION_TYPE as unstable_ViewTransition,
  startTransition,
  use,
  useCallback,
  useDebugValue,
  useId,
  useMemo,
  version,
};
