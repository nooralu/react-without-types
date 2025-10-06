/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReactVersion from "shared/ReactVersion";

import { isValidContainer } from "react-dom-bindings/src/client/ReactDOMContainer";
import { createPortal as createPortalImpl } from "react-reconciler/src/ReactPortal";
import { flushSync } from "./ReactDOMFlushSync";

import {
  preconnect,
  prefetchDNS,
  preinit,
  preinitModule,
  preload,
  preloadModule,
} from "./ReactDOMFloat";
import {
  requestFormReset,
  useFormState,
  useFormStatus,
} from "react-dom-bindings/src/shared/ReactDOMFormActions";

if (__DEV__) {
  if (
    typeof Map !== "function" ||
    // $FlowFixMe[prop-missing] Flow incorrectly thinks Map has no prototype
    Map.prototype == null ||
    typeof Map.prototype.forEach !== "function" ||
    typeof Set !== "function" ||
    // $FlowFixMe[prop-missing] Flow incorrectly thinks Set has no prototype
    Set.prototype == null ||
    typeof Set.prototype.clear !== "function" ||
    typeof Set.prototype.forEach !== "function"
  ) {
    console.error(
      "React depends on Map and Set built-in types. Make sure that you load a " +
        "polyfill in older browsers. https://reactjs.org/link/react-polyfills",
    );
  }
}

function batchedUpdates(fn, a) {
  // batchedUpdates is now just a passthrough noop
  return fn(a);
}

function createPortal(
  children,
  container,
  key = null,
) {
  if (!isValidContainer(container)) {
    throw new Error("Target container is not a DOM element.");
  }

  // TODO: pass ReactDOM portal implementation as third argument
  // $FlowFixMe[incompatible-return] The Flow type is opaque but there's no way to actually create it.
  return createPortalImpl(children, container, null, key);
}

export {
  batchedUpdates as unstable_batchedUpdates,
  createPortal,
  flushSync,
  preconnect,
  prefetchDNS,
  preinit,
  preinitModule,
  preload,
  preloadModule,
  ReactVersion as version,
  requestFormReset,
  useFormState,
  useFormStatus,
};
