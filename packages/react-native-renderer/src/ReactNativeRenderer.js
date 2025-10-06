/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "./ReactNativeInjection";

import {
  batchedUpdates as batchedUpdatesImpl,
  createContainer,
  defaultOnCaughtError,
  defaultOnRecoverableError,
  defaultOnUncaughtError,
  discreteUpdates,
  getPublicRootInstance,
  injectIntoDevTools,
  updateContainer,
} from "react-reconciler/src/ReactFiberReconciler";
// TODO: direct imports like some-package/src/* are bad. Fix me.
import { createPortal as createPortalImpl } from "react-reconciler/src/ReactPortal";
import {
  batchedUpdates,
  setBatchingImplementation,
} from "./legacy-events/ReactGenericBatching";
// Modules provided by RN:
import { UIManager } from "react-native/Libraries/ReactPrivate/ReactNativePrivateInterface";

import { LegacyRoot } from "react-reconciler/src/ReactRootTags";
import {
  dispatchCommand,
  findHostInstance_DEPRECATED,
  findNodeHandle,
  isChildPublicInstance,
  sendAccessibilityEvent,
} from "./ReactNativePublicCompat";

import { disableLegacyMode } from "shared/ReactFeatureFlags";

// Module provided by RN:
import { ReactFiberErrorDialog } from "react-native/Libraries/ReactPrivate/ReactNativePrivateInterface";

import reactNativePackageVersion from "shared/ReactVersion";
import * as IsomorphicReactPackage from "react";

const isomorphicReactPackageVersion = IsomorphicReactPackage.version;
if (isomorphicReactPackageVersion !== reactNativePackageVersion) {
  throw new Error(
    'Incompatible React versions: The "react" and "react-native-renderer" packages must ' +
      "have the exact same version. Instead got:\n" +
      `  - react:                  ${isomorphicReactPackageVersion}\n` +
      `  - react-native-renderer:  ${reactNativePackageVersion}\n` +
      "Learn more: https://react.dev/warnings/version-mismatch",
  );
}

if (typeof ReactFiberErrorDialog.showErrorDialog !== "function") {
  throw new Error(
    "Expected ReactFiberErrorDialog.showErrorDialog to be a function.",
  );
}

function nativeOnUncaughtError(
  error,
  errorInfo,
) {
  const componentStack = errorInfo.componentStack != null
    ? errorInfo.componentStack
    : "";
  const logError = ReactFiberErrorDialog.showErrorDialog({
    errorBoundary: null,
    error,
    componentStack,
  });

  // Allow injected showErrorDialog() to prevent default console.error logging.
  // This enables renderers like ReactNative to better manage redbox behavior.
  if (logError === false) {
    return;
  }

  defaultOnUncaughtError(error, errorInfo);
}
function nativeOnCaughtError(
  error,
  errorInfo,
) {
  const errorBoundary = errorInfo.errorBoundary;
  const componentStack = errorInfo.componentStack != null
    ? errorInfo.componentStack
    : "";
  const logError = ReactFiberErrorDialog.showErrorDialog({
    errorBoundary,
    error,
    componentStack,
  });

  // Allow injected showErrorDialog() to prevent default console.error logging.
  // This enables renderers like ReactNative to better manage redbox behavior.
  if (logError === false) {
    return;
  }

  defaultOnCaughtError(error, errorInfo);
}
function nativeOnDefaultTransitionIndicator() {
  // Native doesn't have a default indicator.
}

function render(
  element,
  containerTag,
  callback,
  options,
) {
  if (disableLegacyMode) {
    throw new Error("render: Unsupported Legacy Mode API.");
  }

  let root = roots.get(containerTag);

  if (!root) {
    // TODO: these defaults are for backwards compatibility.
    // Once RN implements these options internally,
    // we can remove the defaults and ReactFiberErrorDialog.
    let onUncaughtError = nativeOnUncaughtError;
    let onCaughtError = nativeOnCaughtError;
    let onRecoverableError = defaultOnRecoverableError;

    if (options && options.onUncaughtError !== undefined) {
      onUncaughtError = options.onUncaughtError;
    }
    if (options && options.onCaughtError !== undefined) {
      onCaughtError = options.onCaughtError;
    }
    if (options && options.onRecoverableError !== undefined) {
      onRecoverableError = options.onRecoverableError;
    }

    const rootInstance = {
      containerTag,
      // $FlowExpectedError[incompatible-type] the legacy renderer does not use public root instances
      publicInstance: null,
    };

    // TODO (bvaughn): If we decide to keep the wrapper component,
    // We could create a wrapper for containerTag as well to reduce special casing.
    root = createContainer(
      rootInstance,
      LegacyRoot,
      null,
      false,
      null,
      "",
      onUncaughtError,
      onCaughtError,
      onRecoverableError,
      nativeOnDefaultTransitionIndicator,
      null,
    );
    roots.set(containerTag, root);
  }
  updateContainer(element, root, null, callback);

  return getPublicRootInstance(root);
}

function unmountComponentAtNode(containerTag) {
  const root = roots.get(containerTag);
  if (root) {
    // TODO: Is it safe to reset this now or should I wait since this unmount could be deferred?
    updateContainer(null, root, null, () => {
      roots.delete(containerTag);
    });
  }
}

function unmountComponentAtNodeAndRemoveContainer(containerTag) {
  unmountComponentAtNode(containerTag);

  // Call back into native to remove all of the subviews from this container
  UIManager.removeRootView(containerTag);
}

function createPortal(
  children,
  containerTag,
  key = null,
) {
  return createPortalImpl(children, containerTag, null, key);
}

setBatchingImplementation(batchedUpdatesImpl, discreteUpdates);

const roots = new Map();

export {
  batchedUpdates as unstable_batchedUpdates,
  createPortal,
  dispatchCommand,
  // This is needed for implementation details of TouchableNativeFeedback
  // Remove this once TouchableNativeFeedback doesn't use cloneElement
  findHostInstance_DEPRECATED,
  findNodeHandle,
  // DEV-only:
  isChildPublicInstance,
  render,
  sendAccessibilityEvent,
  unmountComponentAtNode,
  unmountComponentAtNodeAndRemoveContainer,
};

injectIntoDevTools();
