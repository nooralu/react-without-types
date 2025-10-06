/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { enableGestureTransition } from "shared/ReactFeatureFlags";

const ReactSharedInternals = {
  H: null,
  A: null,
  T: null,
  S: null,
};
if (enableGestureTransition) {
  ReactSharedInternals.G = null;
}

if (__DEV__) {
  ReactSharedInternals.actQueue = null;
  ReactSharedInternals.asyncTransitions = 0;
  ReactSharedInternals.isBatchingLegacy = false;
  ReactSharedInternals.didScheduleLegacyUpdate = false;
  ReactSharedInternals.didUsePromise = false;
  ReactSharedInternals.thrownErrors = [];
  // Stack implementation injected by the current renderer.
  ReactSharedInternals.getCurrentStack = null;
  ReactSharedInternals.recentlyCreatedOwnerStacks = 0;
}

export default ReactSharedInternals;
