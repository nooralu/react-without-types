/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { dispatchEvent } from "./ReactFabricEventEmitter";
import {
  ContinuousEventPriority,
  DefaultEventPriority,
  DiscreteEventPriority,
  IdleEventPriority,
  NoEventPriority,
} from "react-reconciler/src/ReactEventPriorities";
import { HostText } from "react-reconciler/src/ReactWorkTags";
import {
  getFragmentParentHostFiber,
  traverseFragmentInstance,
} from "react-reconciler/src/ReactFiberTreeReflection";

// Modules provided by RN:
import {
  createAttributePayload,
  createPublicInstance,
  createPublicTextInstance,
  deepFreezeAndThrowOnMutationInDev,
  diffAttributePayloads,
  ReactNativeViewConfigRegistry,
} from "react-native/Libraries/ReactPrivate/ReactNativePrivateInterface";

const {
  createNode,
  cloneNodeWithNewChildren,
  cloneNodeWithNewChildrenAndProps,
  cloneNodeWithNewProps,
  createChildSet: createChildNodeSet,
  appendChild: appendChildNode,
  appendChildToSet: appendChildNodeToSet,
  completeRoot,
  registerEventHandler,
  unstable_DefaultEventPriority: FabricDefaultPriority,
  unstable_DiscreteEventPriority: FabricDiscretePriority,
  unstable_ContinuousEventPriority: FabricContinuousPriority,
  unstable_IdleEventPriority: FabricIdlePriority,
  unstable_getCurrentEventPriority: fabricGetCurrentEventPriority,
} = nativeFabricUIManager;

import { getClosestInstanceFromNode } from "./ReactFabricComponentTree";
import { compareDocumentPositionForEmptyFragment } from "shared/ReactDOMFragmentRefShared";

import {
  getInspectorDataForInstance,
  getInspectorDataForViewAtPoint,
  getInspectorDataForViewTag,
} from "./ReactNativeFiberInspector";

import { passChildrenWhenCloningPersistedNodes } from "shared/ReactFeatureFlags";
import { REACT_CONTEXT_TYPE } from "shared/ReactSymbols";

export { default as rendererVersion } from "shared/ReactVersion"; // TODO: Consider exporting the react-native version.
export const rendererPackageName = "react-native-renderer";
export const extraDevToolsConfig = {
  getInspectorDataForInstance,
  getInspectorDataForViewTag,
  getInspectorDataForViewAtPoint,
};

const { get: getViewConfigForType } = ReactNativeViewConfigRegistry;

// Counter for uniquely identifying views.
// % 10 === 1 means it is a rootTag.
// % 2 === 0 means it is a Fabric tag.
// This means that they never overlap.
let nextReactTag = 2;

// TODO: Remove this conditional once all changes have propagated.
if (registerEventHandler) {
  /**
   * Register the event emitter with the native bridge
   */
  registerEventHandler(dispatchEvent);
}

export * from "react-reconciler/src/ReactFiberConfigWithNoMutation";
export * from "react-reconciler/src/ReactFiberConfigWithNoHydration";
export * from "react-reconciler/src/ReactFiberConfigWithNoScopes";
export * from "react-reconciler/src/ReactFiberConfigWithNoTestSelectors";
export * from "react-reconciler/src/ReactFiberConfigWithNoResources";
export * from "react-reconciler/src/ReactFiberConfigWithNoSingletons";

export function appendInitialChild(
  parentInstance,
  child,
) {
  appendChildNode(parentInstance.node, child.node);
}

const PROD_HOST_CONTEXT = { isInAParentText: true };

export function createInstance(
  type,
  props,
  rootContainerInstance,
  hostContext,
  internalInstanceHandle,
) {
  const tag = nextReactTag;
  nextReactTag += 2;

  const viewConfig = getViewConfigForType(type);

  if (__DEV__) {
    for (const key in viewConfig.validAttributes) {
      if (props.hasOwnProperty(key)) {
        deepFreezeAndThrowOnMutationInDev(props[key]);
      }
    }
  }

  const updatePayload = createAttributePayload(
    props,
    viewConfig.validAttributes,
  );

  const node = createNode(
    tag, // reactTag
    viewConfig.uiViewClassName, // viewName
    rootContainerInstance.containerTag, // rootTag
    updatePayload, // props
    internalInstanceHandle, // internalInstanceHandle
  );

  return {
    node: node,
    canonical: {
      nativeTag: tag,
      viewConfig,
      currentProps: props,
      internalInstanceHandle,
      publicInstance: null,
      publicRootInstance: rootContainerInstance.publicInstance,
    },
  };
}

export function createTextInstance(
  text,
  rootContainerInstance,
  hostContext,
  internalInstanceHandle,
) {
  if (__DEV__) {
    if (!hostContext.isInAParentText) {
      console.error("Text strings must be rendered within a <Text> component.");
    }
  }

  const tag = nextReactTag;
  nextReactTag += 2;

  const node = createNode(
    tag, // reactTag
    "RCTRawText", // viewName
    rootContainerInstance.containerTag, // rootTag
    { text: text }, // props
    internalInstanceHandle, // instance handle
  );

  return {
    node: node,
  };
}

export function finalizeInitialChildren(
  parentInstance,
  type,
  props,
  hostContext,
) {
  return false;
}

export function getRootHostContext(
  rootContainerInstance,
) {
  if (__DEV__) {
    return { isInAParentText: false };
  }

  return PROD_HOST_CONTEXT;
}

export function getChildHostContext(
  parentHostContext,
  type,
) {
  if (__DEV__) {
    const prevIsInAParentText = parentHostContext.isInAParentText;
    const isInAParentText = type === "AndroidTextInput" || // Android
      type === "RCTMultilineTextInputView" || // iOS
      type === "RCTSinglelineTextInputView" || // iOS
      type === "RCTText" ||
      type === "RCTVirtualText";

    // TODO: If this is an offscreen host container, we should reuse the
    // parent context.

    if (prevIsInAParentText !== isInAParentText) {
      return { isInAParentText };
    }
  }

  return parentHostContext;
}

export function getPublicInstance(instance) {
  if (instance.canonical != null) {
    if (instance.canonical.publicInstance == null) {
      instance.canonical.publicInstance = createPublicInstance(
        instance.canonical.nativeTag,
        instance.canonical.viewConfig,
        instance.canonical.internalInstanceHandle,
        instance.canonical.publicRootInstance ?? null,
      );
      // This was only necessary to create the public instance.
      instance.canonical.publicRootInstance = null;
    }

    return instance.canonical.publicInstance;
  }

  // Handle root containers
  if (instance.containerInfo != null) {
    if (instance.containerInfo.publicInstance != null) {
      return instance.containerInfo.publicInstance;
    }
  }

  // For compatibility with the legacy renderer, in case it's used with Fabric
  // in the same app.
  // $FlowExpectedError[prop-missing]
  if (instance._nativeTag != null) {
    // $FlowExpectedError[incompatible-return]
    return instance;
  }

  return null;
}

function getPublicTextInstance(
  textInstance,
  internalInstanceHandle,
) {
  if (textInstance.publicInstance == null) {
    textInstance.publicInstance = createPublicTextInstance(
      internalInstanceHandle,
    );
  }
  return textInstance.publicInstance;
}

export function getPublicInstanceFromInternalInstanceHandle(
  internalInstanceHandle,
) {
  const instance = internalInstanceHandle.stateNode;

  // React resets all the fields in the fiber when the component is unmounted
  // to prevent memory leaks.
  if (instance == null) {
    return null;
  }

  if (internalInstanceHandle.tag === HostText) {
    const textInstance = instance;
    return getPublicTextInstance(textInstance, internalInstanceHandle);
  }

  const elementInstance = internalInstanceHandle.stateNode;
  return getPublicInstance(elementInstance);
}

function getPublicInstanceFromHostFiber(fiber) {
  const publicInstance = getPublicInstance(fiber.stateNode);
  if (publicInstance === null) {
    throw new Error("Expected to find a host node. This is a bug in React.");
  }
  return publicInstance;
}

export function prepareForCommit(containerInfo) {
  // Noop
  return null;
}

export function resetAfterCommit(containerInfo) {
  // Noop
}

export function shouldSetTextContent(type, props) {
  // TODO (bvaughn) Revisit this decision.
  // Always returning false simplifies the createInstance() implementation,
  // But creates an additional child Fiber for raw text children.
  // No additional native views are created though.
  // It's not clear to me which is better so I'm deferring for now.
  // More context @ github.com/facebook/react/pull/8560#discussion_r92111303
  return false;
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

  const currentEventPriority = fabricGetCurrentEventPriority
    ? fabricGetCurrentEventPriority()
    : null;

  if (currentEventPriority != null) {
    switch (currentEventPriority) {
      case FabricDiscretePriority:
        return DiscreteEventPriority;
      case FabricContinuousPriority:
        return ContinuousEventPriority;
      case FabricIdlePriority:
        return IdleEventPriority;
      case FabricDefaultPriority:
      default:
        return DefaultEventPriority;
    }
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

// The Fabric renderer is secondary to the existing React Native renderer.
export const isPrimaryRenderer = false;

// The Fabric renderer shouldn't trigger missing act() warnings
export const warnsIfNotActing = false;

export const scheduleTimeout = setTimeout;
export const cancelTimeout = clearTimeout;
export const noTimeout = -1;

// -------------------
//     Persistence
// -------------------

export const supportsPersistence = true;

export function cloneInstance(
  instance,
  type,
  oldProps,
  newProps,
  keepChildren,
  newChildSet,
) {
  const viewConfig = instance.canonical.viewConfig;
  const updatePayload = diffAttributePayloads(
    oldProps,
    newProps,
    viewConfig.validAttributes,
  );
  // TODO: If the event handlers have changed, we need to update the current props
  // in the commit phase but there is no host config hook to do it yet.
  // So instead we hack it by updating it in the render phase.
  instance.canonical.currentProps = newProps;

  const node = instance.node;
  let clone;
  if (keepChildren) {
    if (updatePayload !== null) {
      clone = cloneNodeWithNewProps(node, updatePayload);
    } else {
      // No changes
      return instance;
    }
  } else {
    // If passChildrenWhenCloningPersistedNodes is enabled, children will be non-null
    if (newChildSet != null) {
      if (updatePayload !== null) {
        clone = cloneNodeWithNewChildrenAndProps(
          node,
          newChildSet,
          updatePayload,
        );
      } else {
        clone = cloneNodeWithNewChildren(node, newChildSet);
      }
    } else {
      if (updatePayload !== null) {
        clone = cloneNodeWithNewChildrenAndProps(node, updatePayload);
      } else {
        clone = cloneNodeWithNewChildren(node);
      }
    }
  }

  return {
    node: clone,
    canonical: instance.canonical,
  };
}

export function cloneHiddenInstance(
  instance,
  type,
  props,
) {
  const viewConfig = instance.canonical.viewConfig;
  const node = instance.node;
  const updatePayload = createAttributePayload(
    { style: { display: "none" } },
    viewConfig.validAttributes,
  );
  return {
    node: cloneNodeWithNewProps(node, updatePayload),
    canonical: instance.canonical,
  };
}

export function cloneHiddenTextInstance(
  instance,
  text,
) {
  throw new Error("Not yet implemented.");
}

export function createContainerChildSet() {
  if (passChildrenWhenCloningPersistedNodes) {
    return [];
  } else {
    return createChildNodeSet();
  }
}

export function appendChildToContainerChildSet(
  childSet,
  child,
) {
  if (passChildrenWhenCloningPersistedNodes) {
    childSet.push(child.node);
  } else {
    appendChildNodeToSet(childSet, child.node);
  }
}

export function finalizeContainerChildren(
  container,
  newChildren,
) {
  // Noop - children will be replaced in replaceContainerChildren
}

export function replaceContainerChildren(
  container,
  newChildren,
) {
  completeRoot(container.containerTag, newChildren);
}

export { getClosestInstanceFromNode as getInstanceFromNode };

export function beforeActiveInstanceBlur(
  internalInstanceHandle,
) {
  // noop
}

export function afterActiveInstanceBlur() {
  // noop
}

export function preparePortalMount(portalInstance) {
  // noop
}

export function detachDeletedInstance(node) {
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

function FragmentInstance(fragmentFiber) {
  this._fragmentFiber = fragmentFiber;
  this._observers = null;
}

// $FlowFixMe[prop-missing]
FragmentInstance.prototype.observeUsing = function (
  observer,
) {
  if (this._observers === null) {
    this._observers = new Set();
  }
  this._observers.add(observer);
  traverseFragmentInstance(this._fragmentFiber, observeChild, observer);
};
function observeChild(child, observer) {
  const publicInstance = getPublicInstanceFromHostFiber(child);
  // $FlowFixMe[incompatible-call] DOM types expect Element
  observer.observe(publicInstance);
  return false;
}
// $FlowFixMe[prop-missing]
FragmentInstance.prototype.unobserveUsing = function (
  observer,
) {
  const observers = this._observers;
  if (observers === null || !observers.has(observer)) {
    if (__DEV__) {
      console.error(
        "You are calling unobserveUsing() with an observer that is not being observed with this fragment " +
          "instance. First attach the observer with observeUsing()",
      );
    }
  } else {
    observers.delete(observer);
    traverseFragmentInstance(this._fragmentFiber, unobserveChild, observer);
  }
};
function unobserveChild(child, observer) {
  const publicInstance = getPublicInstanceFromHostFiber(child);
  // $FlowFixMe[incompatible-call] DOM types expect Element
  observer.unobserve(publicInstance);
  return false;
}

// $FlowFixMe[prop-missing]
FragmentInstance.prototype.compareDocumentPosition = function (
  otherNode,
) {
  const parentHostFiber = getFragmentParentHostFiber(this._fragmentFiber);
  if (parentHostFiber === null) {
    return Node.DOCUMENT_POSITION_DISCONNECTED;
  }
  const children = [];
  traverseFragmentInstance(this._fragmentFiber, collectChildren, children);
  if (children.length === 0) {
    const parentHostInstance = getPublicInstanceFromHostFiber(parentHostFiber);
    return compareDocumentPositionForEmptyFragment(
      this._fragmentFiber,
      parentHostInstance,
      otherNode,
      getPublicInstanceFromHostFiber,
    );
  }

  const firstInstance = getPublicInstanceFromHostFiber(children[0]);
  const lastInstance = getPublicInstanceFromHostFiber(
    children[children.length - 1],
  );

  // $FlowFixMe[incompatible-use] Fabric PublicInstance is opaque
  // $FlowFixMe[prop-missing]
  const firstResult = firstInstance.compareDocumentPosition(otherNode);
  // $FlowFixMe[incompatible-use] Fabric PublicInstance is opaque
  // $FlowFixMe[prop-missing]
  const lastResult = lastInstance.compareDocumentPosition(otherNode);

  const otherNodeIsFirstOrLastChild = firstInstance === otherNode ||
    lastInstance === otherNode;
  const otherNodeIsWithinFirstOrLastChild =
    firstResult & Node.DOCUMENT_POSITION_CONTAINED_BY ||
    lastResult & Node.DOCUMENT_POSITION_CONTAINED_BY;
  const otherNodeIsBetweenFirstAndLastChildren =
    firstResult & Node.DOCUMENT_POSITION_FOLLOWING &&
    lastResult & Node.DOCUMENT_POSITION_PRECEDING;
  let result;
  if (
    otherNodeIsFirstOrLastChild ||
    otherNodeIsWithinFirstOrLastChild ||
    otherNodeIsBetweenFirstAndLastChildren
  ) {
    result = Node.DOCUMENT_POSITION_CONTAINED_BY;
  } else {
    result = firstResult;
  }

  return result;
};

function collectChildren(child, collection) {
  collection.push(child);
  return false;
}

export function createFragmentInstance(
  fragmentFiber,
) {
  return new FragmentInstance(fragmentFiber);
}

export function updateFragmentInstanceFiber(
  fragmentFiber,
  instance,
) {
  instance._fragmentFiber = fragmentFiber;
}

export function commitNewChildToFragmentInstance(
  childInstance,
  fragmentInstance,
) {
  const publicInstance = getPublicInstance(childInstance);
  if (fragmentInstance._observers !== null) {
    if (publicInstance == null) {
      throw new Error("Expected to find a host node. This is a bug in React.");
    }
    fragmentInstance._observers.forEach((observer) => {
      // $FlowFixMe[incompatible-call] Element types are behind a flag in RN
      observer.observe(publicInstance);
    });
  }
}

export function deleteChildFromFragmentInstance(
  child,
  fragmentInstance,
) {
  // Noop
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

// -------------------
//     Microtasks
// -------------------

export const supportsMicrotasks =
  typeof RN$enableMicrotasksInReact !== "undefined" &&
  !!RN$enableMicrotasksInReact;

export const scheduleMicrotask = typeof queueMicrotask === "function"
  ? queueMicrotask
  : scheduleTimeout;
