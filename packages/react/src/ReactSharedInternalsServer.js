/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  TaintRegistryByteLengths,
  TaintRegistryObjects,
  TaintRegistryPendingRequests,
  TaintRegistryValues,
} from "./ReactTaintRegistry";

import { enableTaint } from "shared/ReactFeatureFlags";

const ReactSharedInternals = {
  H: null,
  A: null,
};

if (enableTaint) {
  ReactSharedInternals.TaintRegistryObjects = TaintRegistryObjects;
  ReactSharedInternals.TaintRegistryValues = TaintRegistryValues;
  ReactSharedInternals.TaintRegistryByteLengths = TaintRegistryByteLengths;
  ReactSharedInternals.TaintRegistryPendingRequests =
    TaintRegistryPendingRequests;
}

if (__DEV__) {
  // Stack implementation injected by the current renderer.
  ReactSharedInternals.getCurrentStack = null;
  ReactSharedInternals.recentlyCreatedOwnerStacks = 0;
}

export default ReactSharedInternals;
