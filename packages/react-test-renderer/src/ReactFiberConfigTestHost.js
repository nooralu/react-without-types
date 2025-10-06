/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isArray from "shared/isArray";
import { REACT_CONTEXT_TYPE } from "shared/ReactSymbols";
import {
  DefaultEventPriority,
  NoEventPriority,
} from "react-reconciler/src/ReactEventPriorities";
import { enableProfilerTimer } from "shared/ReactFeatureFlags";

export { default as rendererVersion } from "shared/ReactVersion"; // TODO: Consider exporting the react-native version.
export const rendererPackageName = "react-test-renderer";
export const extraDevToolsConfig = null;

// Unused

export * from "react-reconciler/src/ReactFiberConfigWithNoPersistence";
export * from "react-reconciler/src/ReactFiberConfigWithNoHydration";
export * from "react-reconciler/src/ReactFiberConfigWithNoTestSelectors";
export * from "react-reconciler/src/ReactFiberConfigWithNoMicrotasks";
export * from "react-reconciler/src/ReactFiberConfigWithNoResources";
export * from "react-reconciler/src/ReactFiberConfigWithNoSingletons";

const NO_CONTEXT = {};
const nodeToInstanceMap = new WeakMap();

if (__DEV__) {
  Object.freeze(NO_CONTEXT);
}

export function getPublicInstance(inst) {
  switch (inst.tag) {
    case "INSTANCE":
      const createNodeMock = inst.rootContainerInstance.createNodeMock;
      const mockNode = createNodeMock({
        type: inst.type,
        props: inst.props,
      });
      if (typeof mockNode === "object" && mockNode !== null) {
        nodeToInstanceMap.set(mockNode, inst);
      }
      return mockNode;
    default:
      return inst;
  }
}

export function appendChild(
  parentInstance,
  child,
) {
  if (__DEV__) {
    if (!isArray(parentInstance.children)) {
      console.error(
        "An invalid container has been provided. " +
          "This may indicate that another renderer is being used in addition to the test renderer. " +
          "(For example, ReactDOM.createPortal inside of a ReactTestRenderer tree.) " +
          "This is not supported.",
      );
    }
  }
  const index = parentInstance.children.indexOf(child);
  if (index !== -1) {
    parentInstance.children.splice(index, 1);
  }
  parentInstance.children.push(child);
}

export function insertBefore(
  parentInstance,
  child,
  beforeChild,
) {
  const index = parentInstance.children.indexOf(child);
  if (index !== -1) {
    parentInstance.children.splice(index, 1);
  }
  const beforeIndex = parentInstance.children.indexOf(beforeChild);
  parentInstance.children.splice(beforeIndex, 0, child);
}

export function removeChild(
  parentInstance,
  child,
) {
  const index = parentInstance.children.indexOf(child);
  parentInstance.children.splice(index, 1);
}

export function clearContainer(container) {
  container.children.splice(0);
}

export function getRootHostContext(
  rootContainerInstance,
) {
  return NO_CONTEXT;
}

export function getChildHostContext(
  parentHostContext,
  type,
) {
  return NO_CONTEXT;
}

export function prepareForCommit(containerInfo) {
  // noop
  return null;
}

export function resetAfterCommit(containerInfo) {
  // noop
}

export function createInstance(
  type,
  props,
  rootContainerInstance,
  hostContext,
  internalInstanceHandle,
) {
  return {
    type,
    props,
    isHidden: false,
    children: [],
    internalInstanceHandle,
    rootContainerInstance,
    tag: "INSTANCE",
  };
}

export function cloneMutableInstance(
  instance,
  keepChildren,
) {
  return {
    type: instance.type,
    props: instance.props,
    isHidden: instance.isHidden,
    children: keepChildren ? instance.children : [],
    internalInstanceHandle: null,
    rootContainerInstance: instance.rootContainerInstance,
    tag: "INSTANCE",
  };
}

export function appendInitialChild(
  parentInstance,
  child,
) {
  const index = parentInstance.children.indexOf(child);
  if (index !== -1) {
    parentInstance.children.splice(index, 1);
  }
  parentInstance.children.push(child);
}

export function finalizeInitialChildren(
  testElement,
  type,
  props,
  rootContainerInstance,
  hostContext,
) {
  return false;
}

export function shouldSetTextContent(type, props) {
  return false;
}

export function createTextInstance(
  text,
  rootContainerInstance,
  hostContext,
  internalInstanceHandle,
) {
  return {
    text,
    isHidden: false,
    tag: "TEXT",
  };
}

export function cloneMutableTextInstance(
  textInstance,
) {
  return {
    text: textInstance.text,
    isHidden: textInstance.isHidden,
    tag: "TEXT",
  };
}

let currentUpdatePriority = NoEventPriority;
export function setCurrentUpdatePriority(newPriority) {
  currentUpdatePriority = newPriority;
}

export function getCurrentUpdatePriority() {
  return currentUpdatePriority;
}

export function resolveUpdatePriority() {
  if (currentUpdatePriority !== NoEventPriority) {
    return currentUpdatePriority;
  }
  return DefaultEventPriority;
}

export function trackSchedulerEvent() {}
export function resolveEventType() {
  return null;
}
export function resolveEventTimeStamp() {
  return -1.1;
}
export function shouldAttemptEagerTransition() {
  return false;
}

export const isPrimaryRenderer = false;
export const warnsIfNotActing = true;

export const scheduleTimeout = setTimeout;
export const cancelTimeout = clearTimeout;

export const noTimeout = -1;

// -------------------
//     Mutation
// -------------------

export const supportsMutation = true;

export function commitUpdate(
  instance,
  type,
  oldProps,
  newProps,
  internalInstanceHandle,
) {
  instance.type = type;
  instance.props = newProps;
}

export function commitMount(
  instance,
  type,
  newProps,
  internalInstanceHandle,
) {
  // noop
}

export function commitTextUpdate(
  textInstance,
  oldText,
  newText,
) {
  textInstance.text = newText;
}

export function resetTextContent(testElement) {
  // noop
}

export const appendChildToContainer = appendChild;
export const insertInContainerBefore = insertBefore;
export const removeChildFromContainer = removeChild;

export function hideInstance(instance) {
  instance.isHidden = true;
}

export function hideTextInstance(textInstance) {
  textInstance.isHidden = true;
}

export function unhideInstance(instance, props) {
  instance.isHidden = false;
}

export function unhideTextInstance(
  textInstance,
  text,
) {
  textInstance.isHidden = false;
}

export function applyViewTransitionName(
  instance,
  name,
  className,
) {
  // Noop
}

export function restoreViewTransitionName(
  instance,
  props,
) {
  // Noop
}

export function cancelViewTransitionName(
  instance,
  name,
  props,
) {
  // Noop
}

export function cancelRootViewTransitionName(rootContainer) {
  // Noop
}

export function restoreRootViewTransitionName(rootContainer) {
  // Noop
}

export function cloneRootViewTransitionContainer(
  rootContainer,
) {
  return {
    type: "ROOT",
    props: {},
    isHidden: false,
    children: [],
    internalInstanceHandle: null,
    rootContainerInstance: rootContainer,
    tag: "INSTANCE",
  };
}

export function removeRootViewTransitionClone(
  rootContainer,
  clone,
) {
  // Noop since it was never inserted anywhere.
}

export function measureInstance(instance) {
  return null;
}

export function measureClonedInstance(instance) {
  return null;
}

export function wasInstanceInViewport(
  measurement,
) {
  return true;
}

export function hasInstanceChanged(
  oldMeasurement,
  newMeasurement,
) {
  return false;
}

export function hasInstanceAffectedParent(
  oldMeasurement,
  newMeasurement,
) {
  return false;
}

export function startViewTransition(
  suspendedState,
  rootContainer,
  transitionTypes,
  mutationCallback,
  layoutCallback,
  afterMutationCallback,
  spawnedWorkCallback,
  passiveCallback,
  errorCallback,
  blockedCallback, // Profiling-only
  finishedAnimation, // Profiling-only
) {
  mutationCallback();
  layoutCallback();
  // Skip afterMutationCallback(). We don't need it since we're not animating.
  spawnedWorkCallback();
  // Skip passiveCallback(). Spawned work will schedule a task.
  return null;
}

export function startGestureTransition(
  suspendedState,
  rootContainer,
  timeline,
  rangeStart,
  rangeEnd,
  transitionTypes,
  mutationCallback,
  animateCallback,
  errorCallback,
  finishedAnimation, // Profiling-only
) {
  mutationCallback();
  animateCallback();
  if (enableProfilerTimer) {
    finishedAnimation();
  }
  return null;
}

export function stopViewTransition(transition) {}

export function createViewTransitionInstance(
  name,
) {
  return null;
}

export function createFragmentInstance(
  fragmentFiber,
) {
  return null;
}

export function updateFragmentInstanceFiber(
  fragmentFiber,
  instance,
) {
  // Noop
}

export function commitNewChildToFragmentInstance(
  child,
  fragmentInstance,
) {
  // noop
}

export function deleteChildFromFragmentInstance(
  child,
  fragmentInstance,
) {
  // Noop
}

export function getInstanceFromNode(mockNode) {
  const instance = nodeToInstanceMap.get(mockNode);
  if (instance !== undefined) {
    return instance.internalInstanceHandle;
  }
  return null;
}

export function getCurrentGestureOffset(provider) {
  return 0;
}

export function beforeActiveInstanceBlur(internalInstanceHandle) {
  // noop
}

export function afterActiveInstanceBlur() {
  // noop
}

export function preparePortalMount(portalInstance) {
  // noop
}

export function prepareScopeUpdate(scopeInstance, inst) {
  nodeToInstanceMap.set(scopeInstance, inst);
}

export function getInstanceFromScope(scopeInstance) {
  return nodeToInstanceMap.get(scopeInstance) || null;
}

export function detachDeletedInstance(node) {
  // noop
}

export function logRecoverableError(error) {
  // noop
}

export function requestPostPaintCallback(callback) {
  // noop
}

export function maySuspendCommit(type, props) {
  return false;
}

export function maySuspendCommitOnUpdate(
  type,
  oldProps,
  newProps,
) {
  return false;
}

export function maySuspendCommitInSyncRender(
  type,
  props,
) {
  return false;
}

export function preloadInstance(
  instance,
  type,
  props,
) {
  // Return true to indicate it's already loaded
  return true;
}

export function startSuspendingCommit() {
  return null;
}

export function suspendInstance(
  state,
  instance,
  type,
  props,
) {}

export function suspendOnActiveViewTransition(
  state,
  container,
) {}

export function waitForCommitToBeReady(
  state,
  timeoutOffset,
) {
  return null;
}

export function getSuspendedCommitReason(
  state,
  rootContainer,
) {
  return null;
}

export const NotPendingTransition = null;
export const HostTransitionContext = {
  $$typeof: REACT_CONTEXT_TYPE,
  Provider: (null),
  Consumer: (null),
  _currentValue: NotPendingTransition,
  _currentValue2: NotPendingTransition,
  _threadCount: 0,
};

export function resetFormInstance(form) {}
