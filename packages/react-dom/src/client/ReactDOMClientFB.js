/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { disableLegacyMode } from "shared/ReactFeatureFlags";
import { isValidContainer } from "react-dom-bindings/src/client/ReactDOMContainer";
import { createEventHandle } from "react-dom-bindings/src/client/ReactDOMEventHandle";
import { runWithPriority } from "react-dom-bindings/src/client/ReactDOMUpdatePriority";
import { flushSync as flushSyncIsomorphic } from "../shared/ReactDOMFlushSync";

import {
  findHostInstance,
  flushSyncFromReconciler as flushSyncWithoutWarningIfAlreadyRendering,
  injectIntoDevTools,
  isAlreadyRendering,
} from "react-reconciler/src/ReactFiberReconciler";
import { createPortal as createPortalImpl } from "react-reconciler/src/ReactPortal";
import { canUseDOM } from "shared/ExecutionEnvironment";
import ReactVersion from "shared/ReactVersion";

import { ensureCorrectIsomorphicReactVersion } from "../shared/ensureCorrectIsomorphicReactVersion";
ensureCorrectIsomorphicReactVersion();

import {
  getFiberCurrentPropsFromNode,
  getInstanceFromNode,
  getNodeFromInstance,
} from "react-dom-bindings/src/client/ReactDOMComponentTree";
import {
  enqueueStateRestore,
  restoreStateIfNeeded,
} from "react-dom-bindings/src/events/ReactDOMControlledComponent";
import Internals from "../ReactDOMSharedInternalsFB";

export {
  preconnect,
  prefetchDNS,
  preinit,
  preinitModule,
  preload,
  preloadModule,
} from "../shared/ReactDOMFloat";
export {
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
        "polyfill in older browsers. https://react.dev/link/react-polyfills",
    );
  }
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

// Overload the definition to the two valid signatures.
// Warning, this opts-out of checking the function body.
function flushSyncFromReconciler(fn) {
  if (__DEV__) {
    if (isAlreadyRendering()) {
      console.error(
        "flushSync was called from inside a lifecycle method. React cannot " +
          "flush when React is already rendering. Consider moving this call to " +
          "a scheduler task or micro task.",
      );
    }
  }
  // $FlowFixMe[incompatible-call]
  return flushSyncWithoutWarningIfAlreadyRendering(fn);
}

const flushSync = disableLegacyMode
  ? flushSyncIsomorphic
  : flushSyncFromReconciler;

function findDOMNode(
  componentOrElement,
) {
  return findHostInstance(componentOrElement);
}

// Expose findDOMNode on internals
Internals.findDOMNode = findDOMNode;

function unstable_batchedUpdates(fn, a) {
  // batchedUpdates was a legacy mode feature that is a no-op outside of
  // legacy mode. In 19, we made it an actual no-op, but we're keeping it
  // for now since there may be libraries that still include it.
  return fn(a);
}

export {
  // enableCreateEventHandleAPI
  createEventHandle as unstable_createEventHandle,
  createPortal,
  flushSync,
  ReactVersion as version,
  // TODO: Remove this once callers migrate to alternatives.
  // This should only be used by React internals.
  runWithPriority as unstable_runWithPriority,
  unstable_batchedUpdates,
};

// Keep in sync with ReactTestUtils.js.
// This is an array for better minification.
Internals.Events /* Events */ = [
  getInstanceFromNode,
  getNodeFromInstance,
  getFiberCurrentPropsFromNode,
  enqueueStateRestore,
  restoreStateIfNeeded,
  unstable_batchedUpdates,
];

const foundDevTools = injectIntoDevTools();

if (__DEV__) {
  if (!foundDevTools && canUseDOM && window.top === window.self) {
    // If we're in Chrome or Firefox, provide a download link if not installed.
    if (
      (navigator.userAgent.indexOf("Chrome") > -1 &&
        navigator.userAgent.indexOf("Edge") === -1) ||
      navigator.userAgent.indexOf("Firefox") > -1
    ) {
      const protocol = window.location.protocol;
      // Don't warn in exotic cases like chrome-extension://.
      if (/^(https?|file):$/.test(protocol)) {
        // eslint-disable-next-line react-internal/no-production-logging
        console.info(
          "%cDownload the React DevTools " +
            "for a better development experience: " +
            "https://react.dev/link/react-devtools" +
            (protocol === "file:"
              ? "\nYou might need to use a local HTTP server (instead of file://): " +
                "https://react.dev/link/react-devtools-faq"
              : ""),
          "font-weight:bold",
        );
      }
    }
  }
}
