/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { noTimeout } from "./ReactFiberConfig";
import { createHostRootFiber } from "./ReactFiber";
import {
  createLaneMap,
  NoLane,
  NoLanes,
  NoTimestamp,
  TotalLanes,
} from "./ReactFiberLane";
import {
  disableLegacyMode,
  enableDefaultTransitionIndicator,
  enableGestureTransition,
  enableProfilerCommitHooks,
  enableProfilerTimer,
  enableSuspenseCallback,
  enableTransitionTracing,
  enableUpdaterTracking,
  enableViewTransition,
} from "shared/ReactFeatureFlags";
import { initializeUpdateQueue } from "./ReactFiberClassUpdateQueue";
import { ConcurrentRoot, LegacyRoot } from "./ReactRootTags";
import { createCache, retainCache } from "./ReactFiberCacheComponent";

function FiberRootNode(
  containerInfo,
  // $FlowFixMe[missing-local-annot]
  tag,
  hydrate,
  identifierPrefix,
  onUncaughtError,
  onCaughtError,
  onRecoverableError,
  onDefaultTransitionIndicator,
  formState,
) {
  this.tag = disableLegacyMode ? ConcurrentRoot : tag;
  this.containerInfo = containerInfo;
  this.pendingChildren = null;
  this.current = null;
  this.pingCache = null;
  this.timeoutHandle = noTimeout;
  this.cancelPendingCommit = null;
  this.context = null;
  this.pendingContext = null;
  this.next = null;
  this.callbackNode = null;
  this.callbackPriority = NoLane;
  this.expirationTimes = createLaneMap(NoTimestamp);

  this.pendingLanes = NoLanes;
  this.suspendedLanes = NoLanes;
  this.pingedLanes = NoLanes;
  this.warmLanes = NoLanes;
  this.expiredLanes = NoLanes;
  if (enableDefaultTransitionIndicator) {
    this.indicatorLanes = NoLanes;
  }
  this.errorRecoveryDisabledLanes = NoLanes;
  this.shellSuspendCounter = 0;

  this.entangledLanes = NoLanes;
  this.entanglements = createLaneMap(NoLanes);

  this.hiddenUpdates = createLaneMap(null);

  this.identifierPrefix = identifierPrefix;
  this.onUncaughtError = onUncaughtError;
  this.onCaughtError = onCaughtError;
  this.onRecoverableError = onRecoverableError;

  if (enableDefaultTransitionIndicator) {
    this.onDefaultTransitionIndicator = onDefaultTransitionIndicator;
    this.pendingIndicator = null;
  }

  this.pooledCache = null;
  this.pooledCacheLanes = NoLanes;

  if (enableSuspenseCallback) {
    this.hydrationCallbacks = null;
  }

  this.formState = formState;

  if (enableViewTransition) {
    this.transitionTypes = null;
  }

  if (enableGestureTransition) {
    this.pendingGestures = null;
    this.stoppingGestures = null;
    this.gestureClone = null;
  }

  this.incompleteTransitions = new Map();
  if (enableTransitionTracing) {
    this.transitionCallbacks = null;
    this.transitionLanes = createLaneMap(null);
  }

  if (enableProfilerTimer && enableProfilerCommitHooks) {
    this.effectDuration = -0;
    this.passiveEffectDuration = -0;
  }

  if (enableUpdaterTracking) {
    this.memoizedUpdaters = new Set();
    const pendingUpdatersLaneMap = (this.pendingUpdatersLaneMap = []);
    for (let i = 0; i < TotalLanes; i++) {
      pendingUpdatersLaneMap.push(new Set());
    }
  }

  if (__DEV__) {
    if (disableLegacyMode) {
      // TODO: This varies by each renderer.
      this._debugRootType = hydrate ? "hydrateRoot()" : "createRoot()";
    } else {
      switch (tag) {
        case ConcurrentRoot:
          this._debugRootType = hydrate ? "hydrateRoot()" : "createRoot()";
          break;
        case LegacyRoot:
          this._debugRootType = hydrate ? "hydrate()" : "render()";
          break;
      }
    }
  }
}

export function createFiberRoot(
  containerInfo,
  tag,
  hydrate,
  initialChildren,
  hydrationCallbacks,
  isStrictMode,
  // TODO: We have several of these arguments that are conceptually part of the
  // host config, but because they are passed in at runtime, we have to thread
  // them through the root constructor. Perhaps we should put them all into a
  // single type, like a DynamicHostConfig that is defined by the renderer.
  identifierPrefix,
  formState,
  onUncaughtError,
  onCaughtError,
  onRecoverableError,
  onDefaultTransitionIndicator,
  transitionCallbacks,
) {
  // $FlowFixMe[invalid-constructor] Flow no longer supports calling new on functions
  const root = new FiberRootNode(
    containerInfo,
    tag,
    hydrate,
    identifierPrefix,
    onUncaughtError,
    onCaughtError,
    onRecoverableError,
    onDefaultTransitionIndicator,
    formState,
  );
  if (enableSuspenseCallback) {
    root.hydrationCallbacks = hydrationCallbacks;
  }

  if (enableTransitionTracing) {
    root.transitionCallbacks = transitionCallbacks;
  }

  // Cyclic construction. This cheats the type system right now because
  // stateNode is any.
  const uninitializedFiber = createHostRootFiber(tag, isStrictMode);
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;

  const initialCache = createCache();
  retainCache(initialCache);

  // The pooledCache is a fresh cache instance that is used temporarily
  // for newly mounted boundaries during a render. In general, the
  // pooledCache is always cleared from the root at the end of a render:
  // it is either released when render commits, or moved to an Offscreen
  // component if rendering suspends. Because the lifetime of the pooled
  // cache is distinct from the main memoizedState.cache, it must be
  // retained separately.
  root.pooledCache = initialCache;
  retainCache(initialCache);
  const initialState = {
    element: initialChildren,
    isDehydrated: hydrate,
    cache: initialCache,
  };
  uninitializedFiber.memoizedState = initialState;

  initializeUpdateQueue(uninitializedFiber);

  return root;
}
