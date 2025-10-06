/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { default as __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE } from "./ReactSharedInternalsServer";

import { count, forEach, map, only, toArray } from "./ReactChildren";
import { captureOwnerStack as captureOwnerStackImpl } from "./ReactOwnerStack";
import {
  REACT_FRAGMENT_TYPE,
  REACT_PROFILER_TYPE,
  REACT_STRICT_MODE_TYPE,
  REACT_SUSPENSE_TYPE,
} from "shared/ReactSymbols";
import {
  cloneElement,
  createElement,
  isValidElement,
} from "./jsx/ReactJSXElement";
import { createRef } from "./ReactCreateRef";
import { use, useCallback, useDebugValue, useId, useMemo } from "./ReactHooks";
import { forwardRef } from "./ReactForwardRef";
import { lazy } from "./ReactLazy";
import { memo } from "./ReactMemo";
import { cache, cacheSignal } from "./ReactCacheServer";
import version from "shared/ReactVersion";

const Children = {
  map,
  forEach,
  count,
  toArray,
  only,
};

let captureOwnerStack;
if (__DEV__) {
  captureOwnerStack = captureOwnerStackImpl;
}

export {
  cache,
  cacheSignal,
  captureOwnerStack, // DEV-only
  Children,
  cloneElement,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  REACT_FRAGMENT_TYPE as Fragment,
  REACT_PROFILER_TYPE as Profiler,
  REACT_STRICT_MODE_TYPE as StrictMode,
  REACT_SUSPENSE_TYPE as Suspense,
  use,
  useCallback,
  useDebugValue,
  useId,
  useMemo,
  version,
};
