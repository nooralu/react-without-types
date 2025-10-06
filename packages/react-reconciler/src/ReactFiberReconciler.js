/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LegacyRoot } from "./ReactRootTags";
import {
  findCurrentHostFiber,
  findCurrentHostFiberWithNoPortals,
} from "./ReactFiberTreeReflection";
import { get as getInstance } from "shared/ReactInstanceMap";
import {
  ActivityComponent,
  ClassComponent,
  HostComponent,
  HostRoot,
  HostSingleton,
  SuspenseComponent,
} from "./ReactWorkTags";
import getComponentNameFromFiber from "react-reconciler/src/getComponentNameFromFiber";
import isArray from "shared/isArray";
import {
  disableLegacyMode,
  enableHydrationLaneScheduling,
  enableSchedulingProfiler,
} from "shared/ReactFeatureFlags";
import ReactSharedInternals from "shared/ReactSharedInternals";
import {
  extraDevToolsConfig,
  getPublicInstance,
  rendererPackageName,
  rendererVersion,
} from "./ReactFiberConfig";
import {
  emptyContextObject,
  findCurrentUnmaskedContext,
  isContextProvider as isLegacyContextProvider,
  processChildContext,
} from "./ReactFiberLegacyContext";
import { createFiberRoot } from "./ReactFiberRoot";
import { isRootDehydrated } from "./ReactFiberShellHydration";
import {
  injectInternals,
  injectProfilingHooks,
  markRenderScheduled,
  onScheduleRoot,
} from "./ReactFiberDevToolsHook";
import { startUpdateTimerByLane } from "./ReactProfilerTimer";
import {
  batchedUpdates,
  deferredUpdates,
  discreteUpdates,
  flushPendingEffects,
  flushRoot,
  flushSyncFromReconciler,
  flushSyncWork,
  isAlreadyRendering,
  requestUpdateLane,
  scheduleInitialHydrationOnRoot,
  scheduleUpdateOnFiber,
} from "./ReactFiberWorkLoop";
import { enqueueConcurrentRenderForLane } from "./ReactFiberConcurrentUpdates";
import {
  createUpdate,
  enqueueUpdate,
  entangleTransitions,
} from "./ReactFiberClassUpdateQueue";
import {
  current as ReactCurrentFiberCurrent,
  isRendering as ReactCurrentFiberIsRendering,
  runWithFiberInDEV,
} from "./ReactCurrentFiber";
import { StrictLegacyMode } from "./ReactTypeOfMode";
import {
  claimNextRetryLane,
  getBumpedLaneForHydrationByLane,
  getHighestPriorityPendingLanes,
  higherPriorityLane,
  SelectiveHydrationLane,
  SyncLane,
} from "./ReactFiberLane";
import {
  scheduleRefresh,
  scheduleRoot,
  setRefreshHandler,
} from "./ReactFiberHotReloading";
import ReactVersion from "shared/ReactVersion";
export { createPortal } from "./ReactPortal";
export {
  createComponentSelector,
  createHasPseudoClassSelector,
  createRoleSelector,
  createTestNameSelector,
  createTextSelector,
  findAllNodes,
  findBoundingRects,
  focusWithin,
  getFindAllNodesFailureDescription,
  observeVisibleRects,
} from "./ReactTestSelectors";
export { startHostTransition } from "./ReactFiberHooks";
export {
  defaultOnCaughtError,
  defaultOnRecoverableError,
  defaultOnUncaughtError,
} from "./ReactFiberErrorLogger";
import {
  getLabelForLane,
  TotalLanes,
} from "react-reconciler/src/ReactFiberLane";
import { registerDefaultIndicator } from "./ReactFiberAsyncAction";

let didWarnAboutNestedUpdates;
let didWarnAboutFindNodeInStrictMode;

if (__DEV__) {
  didWarnAboutNestedUpdates = false;
  didWarnAboutFindNodeInStrictMode = {};
}

function getContextForSubtree(
  parentComponent,
) {
  if (!parentComponent) {
    return emptyContextObject;
  }

  const fiber = getInstance(parentComponent);
  const parentContext = findCurrentUnmaskedContext(fiber);

  if (fiber.tag === ClassComponent) {
    const Component = fiber.type;
    if (isLegacyContextProvider(Component)) {
      return processChildContext(fiber, Component, parentContext);
    }
  }

  return parentContext;
}

function findHostInstance(component) {
  const fiber = getInstance(component);
  if (fiber === undefined) {
    if (typeof component.render === "function") {
      throw new Error("Unable to find node on an unmounted component.");
    } else {
      const keys = Object.keys(component).join(",");
      throw new Error(
        `Argument appears to not be a ReactComponent. Keys: ${keys}`,
      );
    }
  }
  const hostFiber = findCurrentHostFiber(fiber);
  if (hostFiber === null) {
    return null;
  }
  return getPublicInstance(hostFiber.stateNode);
}

function findHostInstanceWithWarning(
  component,
  methodName,
) {
  if (__DEV__) {
    const fiber = getInstance(component);
    if (fiber === undefined) {
      if (typeof component.render === "function") {
        throw new Error("Unable to find node on an unmounted component.");
      } else {
        const keys = Object.keys(component).join(",");
        throw new Error(
          `Argument appears to not be a ReactComponent. Keys: ${keys}`,
        );
      }
    }
    const hostFiber = findCurrentHostFiber(fiber);
    if (hostFiber === null) {
      return null;
    }
    if (hostFiber.mode & StrictLegacyMode) {
      const componentName = getComponentNameFromFiber(fiber) || "Component";
      if (!didWarnAboutFindNodeInStrictMode[componentName]) {
        didWarnAboutFindNodeInStrictMode[componentName] = true;
        runWithFiberInDEV(hostFiber, () => {
          if (fiber.mode & StrictLegacyMode) {
            console.error(
              "%s is deprecated in StrictMode. " +
                "%s was passed an instance of %s which is inside StrictMode. " +
                "Instead, add a ref directly to the element you want to reference. " +
                "Learn more about using refs safely here: " +
                "https://react.dev/link/strict-mode-find-node",
              methodName,
              methodName,
              componentName,
            );
          } else {
            console.error(
              "%s is deprecated in StrictMode. " +
                "%s was passed an instance of %s which renders StrictMode children. " +
                "Instead, add a ref directly to the element you want to reference. " +
                "Learn more about using refs safely here: " +
                "https://react.dev/link/strict-mode-find-node",
              methodName,
              methodName,
              componentName,
            );
          }
        });
      }
    }
    return getPublicInstance(hostFiber.stateNode);
  }
  return findHostInstance(component);
}

export function createContainer(
  containerInfo,
  tag,
  hydrationCallbacks,
  isStrictMode,
  // TODO: Remove `concurrentUpdatesByDefaultOverride`. It is now ignored.
  concurrentUpdatesByDefaultOverride,
  identifierPrefix,
  onUncaughtError,
  onCaughtError,
  onRecoverableError,
  onDefaultTransitionIndicator,
  transitionCallbacks,
) {
  const hydrate = false;
  const initialChildren = null;
  const root = createFiberRoot(
    containerInfo,
    tag,
    hydrate,
    initialChildren,
    hydrationCallbacks,
    isStrictMode,
    identifierPrefix,
    null,
    onUncaughtError,
    onCaughtError,
    onRecoverableError,
    onDefaultTransitionIndicator,
    transitionCallbacks,
  );
  registerDefaultIndicator(onDefaultTransitionIndicator);
  return root;
}

export function createHydrationContainer(
  initialChildren,
  // TODO: Remove `callback` when we delete legacy mode.
  callback,
  containerInfo,
  tag,
  hydrationCallbacks,
  isStrictMode,
  // TODO: Remove `concurrentUpdatesByDefaultOverride`. It is now ignored.
  concurrentUpdatesByDefaultOverride,
  identifierPrefix,
  onUncaughtError,
  onCaughtError,
  onRecoverableError,
  onDefaultTransitionIndicator,
  transitionCallbacks,
  formState,
) {
  const hydrate = true;
  const root = createFiberRoot(
    containerInfo,
    tag,
    hydrate,
    initialChildren,
    hydrationCallbacks,
    isStrictMode,
    identifierPrefix,
    formState,
    onUncaughtError,
    onCaughtError,
    onRecoverableError,
    onDefaultTransitionIndicator,
    transitionCallbacks,
  );

  registerDefaultIndicator(onDefaultTransitionIndicator);

  // TODO: Move this to FiberRoot constructor
  root.context = getContextForSubtree(null);

  // Schedule the initial render. In a hydration root, this is different from
  // a regular update because the initial render must match was was rendered
  // on the server.
  // NOTE: This update intentionally doesn't have a payload. We're only using
  // the update to schedule work on the root fiber (and, for legacy roots, to
  // enqueue the callback if one is provided).
  const current = root.current;
  let lane = requestUpdateLane(current);
  if (enableHydrationLaneScheduling) {
    lane = getBumpedLaneForHydrationByLane(lane);
  }
  const update = createUpdate(lane);
  update.callback = callback !== undefined && callback !== null
    ? callback
    : null;
  enqueueUpdate(current, update, lane);
  startUpdateTimerByLane(lane, "hydrateRoot()", null);
  scheduleInitialHydrationOnRoot(root, lane);

  return root;
}

export function updateContainer(
  element,
  container,
  parentComponent,
  callback,
) {
  const current = container.current;
  const lane = requestUpdateLane(current);
  updateContainerImpl(
    current,
    lane,
    element,
    container,
    parentComponent,
    callback,
  );
  return lane;
}

export function updateContainerSync(
  element,
  container,
  parentComponent,
  callback,
) {
  if (!disableLegacyMode && container.tag === LegacyRoot) {
    flushPendingEffects();
  }
  const current = container.current;
  updateContainerImpl(
    current,
    SyncLane,
    element,
    container,
    parentComponent,
    callback,
  );
  return SyncLane;
}

function updateContainerImpl(
  rootFiber,
  lane,
  element,
  container,
  parentComponent,
  callback,
) {
  if (__DEV__) {
    onScheduleRoot(container, element);
  }

  if (enableSchedulingProfiler) {
    markRenderScheduled(lane);
  }

  const context = getContextForSubtree(parentComponent);
  if (container.context === null) {
    container.context = context;
  } else {
    container.pendingContext = context;
  }

  if (__DEV__) {
    if (
      ReactCurrentFiberIsRendering &&
      ReactCurrentFiberCurrent !== null &&
      !didWarnAboutNestedUpdates
    ) {
      didWarnAboutNestedUpdates = true;
      console.error(
        "Render methods should be a pure function of props and state; " +
          "triggering nested component updates from render is not allowed. " +
          "If necessary, trigger nested updates in componentDidUpdate.\n\n" +
          "Check the render method of %s.",
        getComponentNameFromFiber(ReactCurrentFiberCurrent) || "Unknown",
      );
    }
  }

  const update = createUpdate(lane);
  // Caution: React DevTools currently depends on this property
  // being called "element".
  update.payload = { element };

  callback = callback === undefined ? null : callback;
  if (callback !== null) {
    if (__DEV__) {
      if (typeof callback !== "function") {
        console.error(
          "Expected the last optional `callback` argument to be a " +
            "function. Instead received: %s.",
          callback,
        );
      }
    }
    update.callback = callback;
  }

  const root = enqueueUpdate(rootFiber, update, lane);
  if (root !== null) {
    startUpdateTimerByLane(lane, "root.render()", null);
    scheduleUpdateOnFiber(root, rootFiber, lane);
    entangleTransitions(root, rootFiber, lane);
  }
}

export {
  batchedUpdates,
  deferredUpdates,
  discreteUpdates,
  flushPendingEffects as flushPassiveEffects,
  flushSyncFromReconciler,
  flushSyncWork,
  isAlreadyRendering,
};

export function getPublicRootInstance(
  container,
) {
  const containerFiber = container.current;
  if (!containerFiber.child) {
    return null;
  }
  switch (containerFiber.child.tag) {
    case HostSingleton:
    case HostComponent:
      return getPublicInstance(containerFiber.child.stateNode);
    default:
      return containerFiber.child.stateNode;
  }
}

export function attemptSynchronousHydration(fiber) {
  switch (fiber.tag) {
    case HostRoot: {
      const root = fiber.stateNode;
      if (isRootDehydrated(root)) {
        // Flush the first scheduled "update".
        const lanes = getHighestPriorityPendingLanes(root);
        flushRoot(root, lanes);
      }
      break;
    }
    case ActivityComponent:
    case SuspenseComponent: {
      const root = enqueueConcurrentRenderForLane(fiber, SyncLane);
      if (root !== null) {
        scheduleUpdateOnFiber(root, fiber, SyncLane);
      }
      flushSyncWork();
      // If we're still blocked after this, we need to increase
      // the priority of any promises resolving within this
      // boundary so that they next attempt also has higher pri.
      const retryLane = SyncLane;
      markRetryLaneIfNotHydrated(fiber, retryLane);
      break;
    }
  }
}

function markRetryLaneImpl(fiber, retryLane) {
  const suspenseState = fiber.memoizedState;
  if (suspenseState !== null && suspenseState.dehydrated !== null) {
    suspenseState.retryLane = higherPriorityLane(
      suspenseState.retryLane,
      retryLane,
    );
  }
}

// Increases the priority of thenables when they resolve within this boundary.
function markRetryLaneIfNotHydrated(fiber, retryLane) {
  markRetryLaneImpl(fiber, retryLane);
  const alternate = fiber.alternate;
  if (alternate) {
    markRetryLaneImpl(alternate, retryLane);
  }
}

export function attemptContinuousHydration(fiber) {
  if (fiber.tag !== SuspenseComponent && fiber.tag !== ActivityComponent) {
    // We ignore HostRoots here because we can't increase
    // their priority and they should not suspend on I/O,
    // since you have to wrap anything that might suspend in
    // Suspense.
    return;
  }
  const lane = SelectiveHydrationLane;
  const root = enqueueConcurrentRenderForLane(fiber, lane);
  if (root !== null) {
    scheduleUpdateOnFiber(root, fiber, lane);
  }
  markRetryLaneIfNotHydrated(fiber, lane);
}

export function attemptHydrationAtCurrentPriority(fiber) {
  if (fiber.tag !== SuspenseComponent && fiber.tag !== ActivityComponent) {
    // We ignore HostRoots here because we can't increase
    // their priority other than synchronously flush it.
    return;
  }
  let lane = requestUpdateLane(fiber);
  if (enableHydrationLaneScheduling) {
    lane = getBumpedLaneForHydrationByLane(lane);
  }
  const root = enqueueConcurrentRenderForLane(fiber, lane);
  if (root !== null) {
    scheduleUpdateOnFiber(root, fiber, lane);
  }
  markRetryLaneIfNotHydrated(fiber, lane);
}

export { findHostInstance };

export { findHostInstanceWithWarning };

export function findHostInstanceWithNoPortals(
  fiber,
) {
  const hostFiber = findCurrentHostFiberWithNoPortals(fiber);
  if (hostFiber === null) {
    return null;
  }
  return getPublicInstance(hostFiber.stateNode);
}

let shouldErrorImpl = (fiber) => null;

export function shouldError(fiber) {
  return shouldErrorImpl(fiber);
}

let shouldSuspendImpl = (fiber) => false;

export function shouldSuspend(fiber) {
  return shouldSuspendImpl(fiber);
}

let overrideHookState = null;
let overrideHookStateDeletePath = null;
let overrideHookStateRenamePath = null;
let overrideProps = null;
let overridePropsDeletePath = null;
let overridePropsRenamePath = null;
let scheduleUpdate = null;
let scheduleRetry = null;
let setErrorHandler = null;
let setSuspenseHandler = null;

if (__DEV__) {
  const copyWithDeleteImpl = (
    obj,
    path,
    index,
  ) => {
    const key = path[index];
    const updated = isArray(obj) ? obj.slice() : { ...obj };
    if (index + 1 === path.length) {
      if (isArray(updated)) {
        updated.splice(key, 1);
      } else {
        delete updated[key];
      }
      return updated;
    }
    // $FlowFixMe[incompatible-use] number or string is fine here
    updated[key] = copyWithDeleteImpl(obj[key], path, index + 1);
    return updated;
  };

  const copyWithDelete = (
    obj,
    path,
  ) => {
    return copyWithDeleteImpl(obj, path, 0);
  };

  const copyWithRenameImpl = (
    obj,
    oldPath,
    newPath,
    index,
  ) => {
    const oldKey = oldPath[index];
    const updated = isArray(obj) ? obj.slice() : { ...obj };
    if (index + 1 === oldPath.length) {
      const newKey = newPath[index];
      // $FlowFixMe[incompatible-use] number or string is fine here
      updated[newKey] = updated[oldKey];
      if (isArray(updated)) {
        updated.splice(oldKey, 1);
      } else {
        delete updated[oldKey];
      }
    } else {
      // $FlowFixMe[incompatible-use] number or string is fine here
      updated[oldKey] = copyWithRenameImpl(
        // $FlowFixMe[incompatible-use] number or string is fine here
        obj[oldKey],
        oldPath,
        newPath,
        index + 1,
      );
    }
    return updated;
  };

  const copyWithRename = (
    obj,
    oldPath,
    newPath,
  ) => {
    if (oldPath.length !== newPath.length) {
      console.warn("copyWithRename() expects paths of the same length");
      return;
    } else {
      for (let i = 0; i < newPath.length - 1; i++) {
        if (oldPath[i] !== newPath[i]) {
          console.warn(
            "copyWithRename() expects paths to be the same except for the deepest key",
          );
          return;
        }
      }
    }
    return copyWithRenameImpl(obj, oldPath, newPath, 0);
  };

  const copyWithSetImpl = (
    obj,
    path,
    index,
    value,
  ) => {
    if (index >= path.length) {
      return value;
    }
    const key = path[index];
    const updated = isArray(obj) ? obj.slice() : { ...obj };
    // $FlowFixMe[incompatible-use] number or string is fine here
    updated[key] = copyWithSetImpl(obj[key], path, index + 1, value);
    return updated;
  };

  const copyWithSet = (
    obj,
    path,
    value,
  ) => {
    return copyWithSetImpl(obj, path, 0, value);
  };

  const findHook = (fiber, id) => {
    // For now, the "id" of stateful hooks is just the stateful hook index.
    // This may change in the future with e.g. nested hooks.
    let currentHook = fiber.memoizedState;
    while (currentHook !== null && id > 0) {
      currentHook = currentHook.next;
      id--;
    }
    return currentHook;
  };

  // Support DevTools editable values for useState and useReducer.
  overrideHookState = (
    fiber,
    id,
    path,
    value,
  ) => {
    const hook = findHook(fiber, id);
    if (hook !== null) {
      const newState = copyWithSet(hook.memoizedState, path, value);
      hook.memoizedState = newState;
      hook.baseState = newState;

      // We aren't actually adding an update to the queue,
      // because there is no update we can add for useReducer hooks that won't trigger an error.
      // (There's no appropriate action type for DevTools overrides.)
      // As a result though, React will see the scheduled update as a noop and bailout.
      // Shallow cloning props works as a workaround for now to bypass the bailout check.
      fiber.memoizedProps = { ...fiber.memoizedProps };

      const root = enqueueConcurrentRenderForLane(fiber, SyncLane);
      if (root !== null) {
        scheduleUpdateOnFiber(root, fiber, SyncLane);
      }
    }
  };
  overrideHookStateDeletePath = (
    fiber,
    id,
    path,
  ) => {
    const hook = findHook(fiber, id);
    if (hook !== null) {
      const newState = copyWithDelete(hook.memoizedState, path);
      hook.memoizedState = newState;
      hook.baseState = newState;

      // We aren't actually adding an update to the queue,
      // because there is no update we can add for useReducer hooks that won't trigger an error.
      // (There's no appropriate action type for DevTools overrides.)
      // As a result though, React will see the scheduled update as a noop and bailout.
      // Shallow cloning props works as a workaround for now to bypass the bailout check.
      fiber.memoizedProps = { ...fiber.memoizedProps };

      const root = enqueueConcurrentRenderForLane(fiber, SyncLane);
      if (root !== null) {
        scheduleUpdateOnFiber(root, fiber, SyncLane);
      }
    }
  };
  overrideHookStateRenamePath = (
    fiber,
    id,
    oldPath,
    newPath,
  ) => {
    const hook = findHook(fiber, id);
    if (hook !== null) {
      const newState = copyWithRename(hook.memoizedState, oldPath, newPath);
      hook.memoizedState = newState;
      hook.baseState = newState;

      // We aren't actually adding an update to the queue,
      // because there is no update we can add for useReducer hooks that won't trigger an error.
      // (There's no appropriate action type for DevTools overrides.)
      // As a result though, React will see the scheduled update as a noop and bailout.
      // Shallow cloning props works as a workaround for now to bypass the bailout check.
      fiber.memoizedProps = { ...fiber.memoizedProps };

      const root = enqueueConcurrentRenderForLane(fiber, SyncLane);
      if (root !== null) {
        scheduleUpdateOnFiber(root, fiber, SyncLane);
      }
    }
  };

  // Support DevTools props for function components, forwardRef, memo, host components, etc.
  overrideProps = (fiber, path, value) => {
    fiber.pendingProps = copyWithSet(fiber.memoizedProps, path, value);
    if (fiber.alternate) {
      fiber.alternate.pendingProps = fiber.pendingProps;
    }
    const root = enqueueConcurrentRenderForLane(fiber, SyncLane);
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, SyncLane);
    }
  };
  overridePropsDeletePath = (fiber, path) => {
    fiber.pendingProps = copyWithDelete(fiber.memoizedProps, path);
    if (fiber.alternate) {
      fiber.alternate.pendingProps = fiber.pendingProps;
    }
    const root = enqueueConcurrentRenderForLane(fiber, SyncLane);
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, SyncLane);
    }
  };
  overridePropsRenamePath = (
    fiber,
    oldPath,
    newPath,
  ) => {
    fiber.pendingProps = copyWithRename(fiber.memoizedProps, oldPath, newPath);
    if (fiber.alternate) {
      fiber.alternate.pendingProps = fiber.pendingProps;
    }
    const root = enqueueConcurrentRenderForLane(fiber, SyncLane);
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, SyncLane);
    }
  };

  scheduleUpdate = (fiber) => {
    const root = enqueueConcurrentRenderForLane(fiber, SyncLane);
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, SyncLane);
    }
  };

  scheduleRetry = (fiber) => {
    const lane = claimNextRetryLane();
    const root = enqueueConcurrentRenderForLane(fiber, lane);
    if (root !== null) {
      scheduleUpdateOnFiber(root, fiber, lane);
    }
  };

  setErrorHandler = (newShouldErrorImpl) => {
    shouldErrorImpl = newShouldErrorImpl;
  };

  setSuspenseHandler = (newShouldSuspendImpl) => {
    shouldSuspendImpl = newShouldSuspendImpl;
  };
}

function getCurrentFiberForDevTools() {
  return ReactCurrentFiberCurrent;
}

function getLaneLabelMap() {
  if (enableSchedulingProfiler) {
    const map = new Map();

    let lane = 1;
    for (let index = 0; index < TotalLanes; index++) {
      const label = getLabelForLane(lane);
      map.set(lane, label);
      lane *= 2;
    }

    return map;
  } else {
    return null;
  }
}

export function injectIntoDevTools() {
  const internals = {
    bundleType: __DEV__ ? 1 : 0, // Might add PROFILE later.
    version: rendererVersion,
    rendererPackageName: rendererPackageName,
    currentDispatcherRef: ReactSharedInternals,
    // Enables DevTools to detect reconciler version rather than renderer version
    // which may not match for third party renderers.
    reconcilerVersion: ReactVersion,
  };
  if (extraDevToolsConfig !== null) {
    internals.rendererConfig = extraDevToolsConfig;
  }
  if (__DEV__) {
    internals.overrideHookState = overrideHookState;
    internals.overrideHookStateDeletePath = overrideHookStateDeletePath;
    internals.overrideHookStateRenamePath = overrideHookStateRenamePath;
    internals.overrideProps = overrideProps;
    internals.overridePropsDeletePath = overridePropsDeletePath;
    internals.overridePropsRenamePath = overridePropsRenamePath;
    internals.scheduleUpdate = scheduleUpdate;
    internals.scheduleRetry = scheduleRetry;
    internals.setErrorHandler = setErrorHandler;
    internals.setSuspenseHandler = setSuspenseHandler;
    // React Refresh
    internals.scheduleRefresh = scheduleRefresh;
    internals.scheduleRoot = scheduleRoot;
    internals.setRefreshHandler = setRefreshHandler;
    // Enables DevTools to append owner stacks to error messages in DEV mode.
    internals.getCurrentFiber = getCurrentFiberForDevTools;
  }
  if (enableSchedulingProfiler) {
    // Conditionally inject these hooks only if Timeline profiler is supported by this build.
    // This gives DevTools a way to feature detect that isn't tied to version number
    // (since profiling and timeline are controlled by different feature flags).
    internals.getLaneLabelMap = getLaneLabelMap;
    internals.injectProfilingHooks = injectProfilingHooks;
  }
  return injectInternals(internals);
}
