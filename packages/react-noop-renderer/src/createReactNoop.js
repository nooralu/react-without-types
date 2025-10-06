/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * This is a renderer of React that doesn't have a render target output.
 * It is useful to demonstrate the internals of the reconciler in isolation
 * and for testing semantics of reconciliation separate from the host
 * environment.
 */

import * as Scheduler from "scheduler/unstable_mock";
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "shared/ReactSymbols";
import isArray from "shared/isArray";
import { checkPropStringCoercion } from "shared/CheckStringCoercion";
import {
  ConcurrentRoot,
  DefaultEventPriority,
  DiscreteEventPriority,
  IdleEventPriority,
  LegacyRoot,
  NoEventPriority,
} from "react-reconciler/constants";
import { disableLegacyMode } from "shared/ReactFeatureFlags";

import ReactSharedInternals from "shared/ReactSharedInternals";
import ReactVersion from "shared/ReactVersion";

const NO_CONTEXT = {};
const UPPERCASE_CONTEXT = {};
if (__DEV__) {
  Object.freeze(NO_CONTEXT);
}

function createReactNoop(reconciler, useMutation) {
  let instanceCounter = 0;
  let hostUpdateCounter = 0;
  let hostCloneCounter = 0;

  function appendChildToContainerOrInstance(
    parentInstance,
    child,
  ) {
    const prevParent = child.parent;
    if (prevParent !== -1 && prevParent !== parentInstance.id) {
      throw new Error("Reparenting is not allowed");
    }
    child.parent = parentInstance.id;
    const index = parentInstance.children.indexOf(child);
    if (index !== -1) {
      parentInstance.children.splice(index, 1);
    }
    parentInstance.children.push(child);
  }

  function appendChildToContainer(
    parentInstance,
    child,
  ) {
    if (typeof parentInstance.rootID !== "string") {
      // Some calls to this aren't typesafe.
      // This helps surface mistakes in tests.
      throw new Error(
        "appendChildToContainer() first argument is not a container.",
      );
    }
    appendChildToContainerOrInstance(parentInstance, child);
  }

  function appendChild(
    parentInstance,
    child,
  ) {
    if (typeof parentInstance.rootID === "string") {
      // Some calls to this aren't typesafe.
      // This helps surface mistakes in tests.
      throw new Error("appendChild() first argument is not an instance.");
    }
    appendChildToContainerOrInstance(parentInstance, child);
  }

  function insertInContainerOrInstanceBefore(
    parentInstance,
    child,
    beforeChild,
  ) {
    const index = parentInstance.children.indexOf(child);
    if (index !== -1) {
      parentInstance.children.splice(index, 1);
    }
    const beforeIndex = parentInstance.children.indexOf(beforeChild);
    if (beforeIndex === -1) {
      throw new Error("This child does not exist.");
    }
    parentInstance.children.splice(beforeIndex, 0, child);
  }

  function insertInContainerBefore(
    parentInstance,
    child,
    beforeChild,
  ) {
    if (typeof parentInstance.rootID !== "string") {
      // Some calls to this aren't typesafe.
      // This helps surface mistakes in tests.
      throw new Error(
        "insertInContainerBefore() first argument is not a container.",
      );
    }
    insertInContainerOrInstanceBefore(parentInstance, child, beforeChild);
  }

  function insertBefore(
    parentInstance,
    child,
    beforeChild,
  ) {
    if (typeof parentInstance.rootID === "string") {
      // Some calls to this aren't typesafe.
      // This helps surface mistakes in tests.
      throw new Error("insertBefore() first argument is not an instance.");
    }
    insertInContainerOrInstanceBefore(parentInstance, child, beforeChild);
  }

  function clearContainer(container) {
    container.children.splice(0);
  }

  function removeChildFromContainerOrInstance(
    parentInstance,
    child,
  ) {
    const index = parentInstance.children.indexOf(child);
    if (index === -1) {
      throw new Error("This child does not exist.");
    }
    parentInstance.children.splice(index, 1);
  }

  function removeChildFromContainer(
    parentInstance,
    child,
  ) {
    if (typeof parentInstance.rootID !== "string") {
      // Some calls to this aren't typesafe.
      // This helps surface mistakes in tests.
      throw new Error(
        "removeChildFromContainer() first argument is not a container.",
      );
    }
    removeChildFromContainerOrInstance(parentInstance, child);
  }

  function removeChild(
    parentInstance,
    child,
  ) {
    if (typeof parentInstance.rootID === "string") {
      // Some calls to this aren't typesafe.
      // This helps surface mistakes in tests.
      throw new Error("removeChild() first argument is not an instance.");
    }
    removeChildFromContainerOrInstance(parentInstance, child);
  }

  function cloneInstance(
    instance,
    type,
    oldProps,
    newProps,
    keepChildren,
    children,
  ) {
    if (__DEV__) {
      checkPropStringCoercion(newProps.children, "children");
    }
    const clone = {
      id: instance.id,
      type: type,
      parent: instance.parent,
      children: keepChildren ? instance.children : (children ?? []),
      text: shouldSetTextContent(type, newProps)
        ? computeText((newProps.children) + "", instance.context)
        : null,
      prop: newProps.prop,
      hidden: !!newProps.hidden,
      context: instance.context,
    };

    if (type === "suspensey-thing" && typeof newProps.src === "string") {
      clone.src = newProps.src;
    }

    Object.defineProperty(clone, "id", {
      value: clone.id,
      enumerable: false,
    });
    Object.defineProperty(clone, "parent", {
      value: clone.parent,
      enumerable: false,
    });
    Object.defineProperty(clone, "text", {
      value: clone.text,
      enumerable: false,
    });
    Object.defineProperty(clone, "context", {
      value: clone.context,
      enumerable: false,
    });
    hostCloneCounter++;
    return clone;
  }

  function shouldSetTextContent(type, props) {
    if (type === "errorInBeginPhase") {
      throw new Error("Error in host config.");
    }
    return (
      typeof props.children === "string" ||
      typeof props.children === "number" ||
      typeof props.children === "bigint"
    );
  }

  function computeText(rawText, hostContext) {
    return hostContext === UPPERCASE_CONTEXT ? rawText.toUpperCase() : rawText;
  }

  let suspenseyThingCache = null;

  function startSuspendingCommit() {
    // Represents a subscription for all the suspensey things that block a
    // particular commit. Once they've all loaded, the commit phase can proceed.
    return {
      pendingCount: 0,
      commit: null,
    };
  }

  function suspendInstance(
    state,
    instance,
    type,
    props,
  ) {
    const src = props.src;
    if (type === "suspensey-thing" && typeof src === "string") {
      // Attach a listener to the suspensey thing and create a subscription
      // object that uses reference counting to track when all the suspensey
      // things have loaded.
      const record = suspenseyThingCache.get(src);
      if (record === undefined) {
        throw new Error("Could not find record for key.");
      }
      if (record.status === "fulfilled") {
        // Already loaded.
      } else if (record.status === "pending") {
        state.pendingCount++;
        // Stash the subscription on the record. In `resolveSuspenseyThing`,
        // we'll use this fire the commit once all the things have loaded.
        if (record.subscriptions === null) {
          record.subscriptions = [];
        }
        record.subscriptions.push(state);
      }
    } else {
      throw new Error(
        "Did not expect this host component to be visited when suspending " +
          "the commit. Did you check the SuspendCommit flag?",
      );
    }
  }

  function waitForCommitToBeReady(
    state,
    timeoutOffset,
  ) {
    if (state.pendingCount > 0) {
      return (commit) => {
        state.commit = commit;
        const cancelCommit = () => {
          state.commit = null;
        };
        return cancelCommit;
      };
    }
    return null;
  }

  const sharedHostConfig = {
    rendererVersion: ReactVersion,
    rendererPackageName: "react-noop",

    supportsSingletons: false,

    getRootHostContext() {
      return NO_CONTEXT;
    },

    getChildHostContext(parentHostContext, type) {
      if (type === "offscreen") {
        return parentHostContext;
      }
      if (type === "uppercase") {
        return UPPERCASE_CONTEXT;
      }
      return NO_CONTEXT;
    },

    getPublicInstance(instance) {
      return instance;
    },

    createInstance(
      type,
      props,
      rootContainerInstance,
      hostContext,
      internalInstanceHandle,
    ) {
      if (type === "errorInCompletePhase") {
        throw new Error("Error in host config.");
      }
      if (__DEV__) {
        // The `if` statement here prevents auto-disabling of the safe coercion
        // ESLint rule, so we must manually disable it below.
        if (shouldSetTextContent(type, props)) {
          checkPropStringCoercion(props.children, "children");
        }
      }
      const inst = {
        id: instanceCounter++,
        type: type,
        children: [],
        parent: -1,
        text: shouldSetTextContent(type, props)
          // eslint-disable-next-line react-internal/safe-string-coercion
          ? computeText((props.children) + "", hostContext)
          : null,
        prop: props.prop,
        hidden: !!props.hidden,
        context: hostContext,
      };

      if (type === "suspensey-thing" && typeof props.src === "string") {
        inst.src = props.src;
      }

      // Hide from unit tests
      Object.defineProperty(inst, "id", { value: inst.id, enumerable: false });
      Object.defineProperty(inst, "parent", {
        value: inst.parent,
        enumerable: false,
      });
      Object.defineProperty(inst, "text", {
        value: inst.text,
        enumerable: false,
      });
      Object.defineProperty(inst, "context", {
        value: inst.context,
        enumerable: false,
      });
      Object.defineProperty(inst, "fiber", {
        value: internalInstanceHandle,
        enumerable: false,
      });
      return inst;
    },

    cloneMutableInstance(instance, keepChildren) {
      throw new Error("Not yet implemented.");
    },

    appendInitialChild(
      parentInstance,
      child,
    ) {
      const prevParent = child.parent;
      if (prevParent !== -1 && prevParent !== parentInstance.id) {
        throw new Error("Reparenting is not allowed");
      }
      child.parent = parentInstance.id;
      parentInstance.children.push(child);
    },

    finalizeInitialChildren(
      domElement,
      type,
      props,
    ) {
      return false;
    },

    shouldSetTextContent,

    createTextInstance(
      text,
      rootContainerInstance,
      hostContext,
      internalInstanceHandle,
    ) {
      if (hostContext === UPPERCASE_CONTEXT) {
        text = text.toUpperCase();
      }
      const inst = {
        text: text,
        id: instanceCounter++,
        parent: -1,
        hidden: false,
        context: hostContext,
      };
      // Hide from unit tests
      Object.defineProperty(inst, "id", { value: inst.id, enumerable: false });
      Object.defineProperty(inst, "parent", {
        value: inst.parent,
        enumerable: false,
      });
      Object.defineProperty(inst, "context", {
        value: inst.context,
        enumerable: false,
      });
      return inst;
    },

    cloneMutableTextInstance(textInstance) {
      throw new Error("Not yet implemented.");
    },

    createFragmentInstance(fragmentFiber) {
      return null;
    },

    updateFragmentInstanceFiber(fragmentFiber, fragmentInstance) {
      // Noop
    },

    commitNewChildToFragmentInstance(child, fragmentInstance) {
      // Noop
    },

    deleteChildFromFragmentInstance(child, fragmentInstance) {
      // Noop
    },

    scheduleTimeout: setTimeout,
    cancelTimeout: clearTimeout,
    noTimeout: -1,

    supportsMicrotasks: true,
    scheduleMicrotask: typeof queueMicrotask === "function"
      ? queueMicrotask
      : typeof Promise !== "undefined"
      ? (callback) =>
        Promise.resolve(null)
          .then(callback)
          .catch((error) => {
            setTimeout(() => {
              throw error;
            });
          })
      : setTimeout,

    prepareForCommit() {
      return null;
    },

    resetAfterCommit() {},

    setCurrentUpdatePriority,
    getCurrentUpdatePriority,

    resolveUpdatePriority() {
      if (currentUpdatePriority !== NoEventPriority) {
        return currentUpdatePriority;
      }
      return currentEventPriority;
    },

    trackSchedulerEvent() {},

    resolveEventType() {
      return null;
    },

    resolveEventTimeStamp() {
      return -1.1;
    },

    shouldAttemptEagerTransition() {
      return false;
    },

    now: Scheduler.unstable_now,

    isPrimaryRenderer: true,
    warnsIfNotActing: true,
    supportsHydration: false,

    getInstanceFromNode() {
      throw new Error("Not yet implemented.");
    },

    beforeActiveInstanceBlur() {
      // NO-OP
    },

    afterActiveInstanceBlur() {
      // NO-OP
    },

    preparePortalMount() {
      // NO-OP
    },

    prepareScopeUpdate() {},

    getInstanceFromScope() {
      throw new Error("Not yet implemented.");
    },

    detachDeletedInstance() {},

    logRecoverableError() {
      // no-op
    },

    requestPostPaintCallback(callback) {
      const endTime = Scheduler.unstable_now();
      callback(endTime);
    },

    maySuspendCommit(type, props) {
      // Asks whether it's possible for this combination of type and props
      // to ever need to suspend. This is different from asking whether it's
      // currently ready because even if it's ready now, it might get purged
      // from the cache later.
      return type === "suspensey-thing" && typeof props.src === "string";
    },

    maySuspendCommitOnUpdate(
      type,
      oldProps,
      newProps,
    ) {
      // Asks whether it's possible for this combination of type and props
      // to ever need to suspend. This is different from asking whether it's
      // currently ready because even if it's ready now, it might get purged
      // from the cache later.
      return (
        type === "suspensey-thing" &&
        typeof newProps.src === "string" &&
        newProps.src !== oldProps.src
      );
    },

    maySuspendCommitInSyncRender(type, props) {
      return true;
    },

    mayResourceSuspendCommit(resource) {
      throw new Error(
        "Resources are not implemented for React Noop yet. This method should not be called",
      );
    },

    preloadInstance(instance, type, props) {
      if (type !== "suspensey-thing" || typeof props.src !== "string") {
        throw new Error("Attempted to preload unexpected instance: " + type);
      }

      // In addition to preloading an instance, this method asks whether the
      // instance is ready to be committed. If it's not, React may yield to the
      // main thread and ask again. It's possible a load event will fire in
      // between, in which case we can avoid showing a fallback.
      if (suspenseyThingCache === null) {
        suspenseyThingCache = new Map();
      }
      const record = suspenseyThingCache.get(props.src);
      if (record === undefined) {
        const newRecord = {
          status: "pending",
          subscriptions: null,
        };
        suspenseyThingCache.set(props.src, newRecord);
        const onLoadStart = props.onLoadStart;
        if (typeof onLoadStart === "function") {
          onLoadStart();
        }
        return false;
      } else {
        return record.status === "fulfilled";
      }
    },

    preloadResource(resource) {
      throw new Error(
        "Resources are not implemented for React Noop yet. This method should not be called",
      );
    },

    startSuspendingCommit,
    suspendInstance,

    suspendResource(state, resource) {
      throw new Error(
        "Resources are not implemented for React Noop yet. This method should not be called",
      );
    },

    suspendOnActiveViewTransition(
      state,
      container,
    ) {
      // Not implemented
    },

    waitForCommitToBeReady,

    getSuspendedCommitReason(
      state,
      rootContainer,
    ) {
      return null;
    },

    NotPendingTransition: (null),

    resetFormInstance(form) {},

    bindToConsole(methodName, args, badgeName) {
      return Function.prototype.bind.apply(
        // eslint-disable-next-line react-internal/no-production-logging
        console[methodName],
        [console].concat(args),
      );
    },
  };

  const hostConfig = useMutation
    ? {
      ...sharedHostConfig,

      supportsMutation: true,
      supportsPersistence: false,

      commitMount(instance, type, newProps) {
        // Noop
      },

      commitUpdate(
        instance,
        type,
        oldProps,
        newProps,
      ) {
        if (oldProps === null) {
          throw new Error("Should have old props");
        }
        hostUpdateCounter++;
        instance.prop = newProps.prop;
        instance.hidden = !!newProps.hidden;

        if (type === "suspensey-thing" && typeof newProps.src === "string") {
          instance.src = newProps.src;
        }

        if (shouldSetTextContent(type, newProps)) {
          if (__DEV__) {
            checkPropStringCoercion(newProps.children, "children");
          }
          instance.text = computeText(
            (newProps.children) + "",
            instance.context,
          );
        }
      },

      commitTextUpdate(
        textInstance,
        oldText,
        newText,
      ) {
        hostUpdateCounter++;
        textInstance.text = computeText(newText, textInstance.context);
      },

      appendChild,
      appendChildToContainer,
      insertBefore,
      insertInContainerBefore,
      removeChild,
      removeChildFromContainer,
      clearContainer,

      hideInstance(instance) {
        instance.hidden = true;
      },

      hideTextInstance(textInstance) {
        textInstance.hidden = true;
      },

      unhideInstance(instance, props) {
        if (!props.hidden) {
          instance.hidden = false;
        }
      },

      unhideTextInstance(textInstance, text) {
        textInstance.hidden = false;
      },

      applyViewTransitionName(
        instance,
        name,
        className,
      ) {},

      restoreViewTransitionName(instance, props) {},

      cancelViewTransitionName(
        instance,
        name,
        props,
      ) {},

      cancelRootViewTransitionName(rootContainer) {},

      restoreRootViewTransitionName(rootContainer) {},

      cloneRootViewTransitionContainer(rootContainer) {
        throw new Error("Not yet implemented.");
      },

      removeRootViewTransitionClone(
        rootContainer,
        clone,
      ) {
        throw new Error("Not implemented.");
      },

      measureInstance(instance) {
        return null;
      },

      measureClonedInstance(instance) {
        return null;
      },

      wasInstanceInViewport(measurement) {
        return true;
      },

      hasInstanceChanged(
        oldMeasurement,
        newMeasurement,
      ) {
        return false;
      },

      hasInstanceAffectedParent(
        oldMeasurement,
        newMeasurement,
      ) {
        return false;
      },

      startViewTransition(
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
      },

      startGestureTransition(
        rootContainer,
        timeline,
        rangeStart,
        rangeEnd,
        transitionTypes,
        mutationCallback,
        animateCallback,
        errorCallback,
      ) {
        mutationCallback();
        animateCallback();
        return null;
      },

      stopViewTransition(transition) {},

      createViewTransitionInstance(name) {
        return null;
      },

      getCurrentGestureOffset(provider) {
        return 0;
      },

      resetTextContent(instance) {
        instance.text = null;
      },
    }
    : {
      ...sharedHostConfig,
      supportsMutation: false,
      supportsPersistence: true,

      cloneInstance,
      clearContainer,

      createContainerChildSet() {
        return [];
      },

      appendChildToContainerChildSet(
        childSet,
        child,
      ) {
        childSet.push(child);
      },

      finalizeContainerChildren(
        container,
        newChildren,
      ) {
        container.pendingChildren = newChildren;
        if (
          newChildren.length === 1 &&
          newChildren[0].text === "Error when completing root"
        ) {
          // Trigger an error for testing purposes
          throw Error("Error when completing root");
        }
      },

      replaceContainerChildren(
        container,
        newChildren,
      ) {
        container.children = newChildren;
      },

      cloneHiddenInstance(
        instance,
        type,
        props,
      ) {
        const clone = cloneInstance(instance, type, props, props, true, null);
        clone.hidden = true;
        return clone;
      },

      cloneHiddenTextInstance(
        instance,
        text,
      ) {
        const clone = {
          text: instance.text,
          id: instance.id,
          parent: instance.parent,
          hidden: true,
          context: instance.context,
        };
        // Hide from unit tests
        Object.defineProperty(clone, "id", {
          value: clone.id,
          enumerable: false,
        });
        Object.defineProperty(clone, "parent", {
          value: clone.parent,
          enumerable: false,
        });
        Object.defineProperty(clone, "context", {
          value: clone.context,
          enumerable: false,
        });
        return clone;
      },
    };

  const NoopRenderer = reconciler(hostConfig);

  const rootContainers = new Map();
  const roots = new Map();
  const DEFAULT_ROOT_ID = "<default>";

  let currentUpdatePriority = NoEventPriority;
  function setCurrentUpdatePriority(newPriority) {
    currentUpdatePriority = newPriority;
  }

  function getCurrentUpdatePriority() {
    return currentUpdatePriority;
  }

  let currentEventPriority = DefaultEventPriority;

  function createJSXElementForTestComparison(type, props) {
    if (__DEV__) {
      const element = {
        type: type,
        $$typeof: REACT_ELEMENT_TYPE,
        key: null,
        props: props,
        _owner: null,
        _store: __DEV__ ? {} : undefined,
      };
      Object.defineProperty(element, "ref", {
        enumerable: false,
        value: null,
      });
      return element;
    } else {
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type: type,
        key: null,
        ref: null,
        props: props,
      };
    }
  }

  function childToJSX(child, text) {
    if (text !== null) {
      return text;
    }
    if (child === null) {
      return null;
    }
    if (typeof child === "string") {
      return child;
    }
    if (isArray(child)) {
      if (child.length === 0) {
        return null;
      }
      if (child.length === 1) {
        return childToJSX(child[0], null);
      }
      const children = child.map((c) => childToJSX(c, null));
      if (
        children.every(
          (c) =>
            typeof c === "string" ||
            typeof c === "number" ||
            typeof c === "bigint",
        )
      ) {
        return children.join("");
      }
      return children;
    }
    if (isArray(child.children)) {
      // This is an instance.
      const instance = child;
      const children = childToJSX(instance.children, instance.text);
      const props = { prop: instance.prop };
      if (instance.hidden) {
        props.hidden = true;
      }
      if (instance.src) {
        props.src = instance.src;
      }
      if (children !== null) {
        props.children = children;
      }
      return createJSXElementForTestComparison(instance.type, props);
    }
    // This is a text instance
    const textInstance = child;
    if (textInstance.hidden) {
      return "";
    }
    return textInstance.text;
  }

  function getChildren(root) {
    if (root) {
      return root.children;
    } else {
      return null;
    }
  }

  function getPendingChildren(root) {
    if (root) {
      return root.children;
    } else {
      return null;
    }
  }

  function getChildrenAsJSX(root) {
    const children = childToJSX(getChildren(root), null);
    if (children === null) {
      return null;
    }
    if (isArray(children)) {
      return createJSXElementForTestComparison(REACT_FRAGMENT_TYPE, {
        children,
      });
    }
    return children;
  }

  function getPendingChildrenAsJSX(root) {
    const children = childToJSX(getChildren(root), null);
    if (children === null) {
      return null;
    }
    if (isArray(children)) {
      return createJSXElementForTestComparison(REACT_FRAGMENT_TYPE, {
        children,
      });
    }
    return children;
  }

  function flushSync(fn) {
    if (__DEV__) {
      if (NoopRenderer.isAlreadyRendering()) {
        console.error(
          "flushSync was called from inside a lifecycle method. React cannot " +
            "flush when React is already rendering. Consider moving this call to " +
            "a scheduler task or micro task.",
        );
      }
    }
    if (disableLegacyMode) {
      const previousTransition = ReactSharedInternals.T;
      const preivousEventPriority = currentEventPriority;
      try {
        ReactSharedInternals.T = null;
        currentEventPriority = DiscreteEventPriority;
        if (fn) {
          return fn();
        } else {
          return undefined;
        }
      } finally {
        ReactSharedInternals.T = previousTransition;
        currentEventPriority = preivousEventPriority;
        NoopRenderer.flushSyncWork();
      }
    } else {
      return NoopRenderer.flushSyncFromReconciler(fn);
    }
  }

  function onRecoverableError(error) {
    // TODO: Turn this on once tests are fixed
    // console.error(error);
  }
  function onDefaultTransitionIndicator() {}

  let idCounter = 0;

  const ReactNoop = {
    _Scheduler: Scheduler,

    getChildren(rootID = DEFAULT_ROOT_ID) {
      throw new Error(
        "No longer supported due to bad performance when used with `expect()`. " +
          "Use `ReactNoop.getChildrenAsJSX()` instead or, if you really need to, `dangerouslyGetChildren` after you carefully considered the warning in its JSDOC.",
      );
    },

    getPendingChildren(rootID = DEFAULT_ROOT_ID) {
      throw new Error(
        "No longer supported due to bad performance when used with `expect()`. " +
          "Use `ReactNoop.getPendingChildrenAsJSX()` instead or, if you really need to, `dangerouslyGetPendingChildren` after you carefully considered the warning in its JSDOC.",
      );
    },

    /**
     * Prefer using `getChildrenAsJSX`.
     * Using the returned children in `.toEqual` has very poor performance on mismatch due to deep equality checking of fiber structures.
     * Make sure you deeply remove enumerable properties before passing it to `.toEqual`, or, better, use `getChildrenAsJSX` or `toMatchRenderedOutput`.
     */
    dangerouslyGetChildren(rootID = DEFAULT_ROOT_ID) {
      const container = rootContainers.get(rootID);
      return getChildren(container);
    },

    /**
     * Prefer using `getPendingChildrenAsJSX`.
     * Using the returned children in `.toEqual` has very poor performance on mismatch due to deep equality checking of fiber structures.
     * Make sure you deeply remove enumerable properties before passing it to `.toEqual`, or, better, use `getChildrenAsJSX` or `toMatchRenderedOutput`.
     */
    dangerouslyGetPendingChildren(rootID = DEFAULT_ROOT_ID) {
      const container = rootContainers.get(rootID);
      return getPendingChildren(container);
    },

    getOrCreateRootContainer(rootID = DEFAULT_ROOT_ID, tag) {
      let root = roots.get(rootID);
      if (!root) {
        const container = { rootID: rootID, pendingChildren: [], children: [] };
        rootContainers.set(rootID, container);
        root = NoopRenderer.createContainer(
          container,
          tag,
          null,
          null,
          false,
          "",
          NoopRenderer.defaultOnUncaughtError,
          NoopRenderer.defaultOnCaughtError,
          onRecoverableError,
          onDefaultTransitionIndicator,
          null,
        );
        roots.set(rootID, root);
      }
      return root.current.stateNode.containerInfo;
    },

    // TODO: Replace ReactNoop.render with createRoot + root.render
    createRoot(options) {
      const container = {
        rootID: "" + idCounter++,
        pendingChildren: [],
        children: [],
      };
      const fiberRoot = NoopRenderer.createContainer(
        container,
        ConcurrentRoot,
        null,
        null,
        false,
        "",
        options && options.onUncaughtError
          ? options.onUncaughtError
          : NoopRenderer.defaultOnUncaughtError,
        options && options.onCaughtError
          ? options.onCaughtError
          : NoopRenderer.defaultOnCaughtError,
        onRecoverableError,
        options && options.onDefaultTransitionIndicator
          ? options.onDefaultTransitionIndicator
          : onDefaultTransitionIndicator,
        options && options.unstable_transitionCallbacks
          ? options.unstable_transitionCallbacks
          : null,
      );
      return {
        _Scheduler: Scheduler,
        render(children) {
          NoopRenderer.updateContainer(children, fiberRoot, null, null);
        },
        getChildren() {
          return getChildren(container);
        },
        getChildrenAsJSX() {
          return getChildrenAsJSX(container);
        },
      };
    },

    createLegacyRoot() {
      if (disableLegacyMode) {
        throw new Error("createLegacyRoot: Unsupported Legacy Mode API.");
      }

      const container = {
        rootID: "" + idCounter++,
        pendingChildren: [],
        children: [],
      };
      const fiberRoot = NoopRenderer.createContainer(
        container,
        LegacyRoot,
        null,
        null,
        false,
        "",
        NoopRenderer.defaultOnUncaughtError,
        NoopRenderer.defaultOnCaughtError,
        onRecoverableError,
        onDefaultTransitionIndicator,
        null,
      );
      return {
        _Scheduler: Scheduler,
        render(children) {
          NoopRenderer.updateContainer(children, fiberRoot, null, null);
        },
        getChildren() {
          return getChildren(container);
        },
        getChildrenAsJSX() {
          return getChildrenAsJSX(container);
        },
        legacy: true,
      };
    },

    getChildrenAsJSX(rootID = DEFAULT_ROOT_ID) {
      const container = rootContainers.get(rootID);
      return getChildrenAsJSX(container);
    },

    getPendingChildrenAsJSX(rootID = DEFAULT_ROOT_ID) {
      const container = rootContainers.get(rootID);
      return getPendingChildrenAsJSX(container);
    },

    getSuspenseyThingStatus(src) {
      if (suspenseyThingCache === null) {
        return null;
      } else {
        const record = suspenseyThingCache.get(src);
        return record === undefined ? null : record.status;
      }
    },

    resolveSuspenseyThing(key) {
      if (suspenseyThingCache === null) {
        suspenseyThingCache = new Map();
      }
      const record = suspenseyThingCache.get(key);
      if (record === undefined) {
        const newRecord = {
          status: "fulfilled",
          subscriptions: null,
        };
        suspenseyThingCache.set(key, newRecord);
      } else {
        if (record.status === "pending") {
          record.status = "fulfilled";
          const subscriptions = record.subscriptions;
          if (subscriptions !== null) {
            record.subscriptions = null;
            for (let i = 0; i < subscriptions.length; i++) {
              const subscription = subscriptions[i];
              subscription.pendingCount--;
              if (subscription.pendingCount === 0) {
                const commit = subscription.commit;
                subscription.commit = null;
                commit();
              }
            }
          }
        }
      }
    },

    resetSuspenseyThingCache() {
      suspenseyThingCache = null;
    },

    createPortal(
      children,
      container,
      key = null,
    ) {
      return NoopRenderer.createPortal(children, container, null, key);
    },

    // Shortcut for testing a single root
    render(element, callback) {
      ReactNoop.renderToRootWithID(element, DEFAULT_ROOT_ID, callback);
    },

    renderLegacySyncRoot(element, callback) {
      if (disableLegacyMode) {
        throw new Error("createLegacyRoot: Unsupported Legacy Mode API.");
      }
      const rootID = DEFAULT_ROOT_ID;
      const container = ReactNoop.getOrCreateRootContainer(rootID, LegacyRoot);
      const root = roots.get(container.rootID);
      NoopRenderer.updateContainer(element, root, null, callback);
    },

    renderToRootWithID(
      element,
      rootID,
      callback,
    ) {
      const container = ReactNoop.getOrCreateRootContainer(
        rootID,
        ConcurrentRoot,
      );
      const root = roots.get(container.rootID);
      NoopRenderer.updateContainer(element, root, null, callback);
    },

    unmountRootWithID(rootID) {
      const root = roots.get(rootID);
      if (root) {
        NoopRenderer.updateContainer(null, root, null, () => {
          roots.delete(rootID);
          rootContainers.delete(rootID);
        });
      }
    },

    findInstance(
      componentOrElement,
    ) {
      if (componentOrElement == null) {
        return null;
      }
      // Unsound duck typing.
      const component = componentOrElement;
      if (typeof component.id === "number") {
        return component;
      }
      if (__DEV__) {
        return NoopRenderer.findHostInstanceWithWarning(
          component,
          "findInstance",
        );
      }
      return NoopRenderer.findHostInstance(component);
    },

    flushNextYield() {
      Scheduler.unstable_flushNumberOfYields(1);
      return Scheduler.unstable_clearLog();
    },

    startTrackingHostCounters() {
      hostUpdateCounter = 0;
      hostCloneCounter = 0;
    },

    stopTrackingHostCounters() {
      const result = useMutation
        ? {
          hostUpdateCounter,
        }
        : {
          hostCloneCounter,
        };
      hostUpdateCounter = 0;
      hostCloneCounter = 0;

      return result;
    },

    expire: Scheduler.unstable_advanceTime,

    flushExpired() {
      return Scheduler.unstable_flushExpired();
    },

    unstable_runWithPriority: function runWithPriority(
      priority,
      fn,
    ) {
      const previousPriority = getCurrentUpdatePriority();
      try {
        setCurrentUpdatePriority(priority);
        return fn();
      } finally {
        setCurrentUpdatePriority(previousPriority);
      }
    },

    batchedUpdates: NoopRenderer.batchedUpdates,

    deferredUpdates: NoopRenderer.deferredUpdates,

    discreteUpdates: NoopRenderer.discreteUpdates,

    idleUpdates(fn) {
      const prevEventPriority = currentEventPriority;
      currentEventPriority = IdleEventPriority;
      try {
        fn();
      } finally {
        currentEventPriority = prevEventPriority;
      }
    },

    flushSync,
    flushPassiveEffects: NoopRenderer.flushPassiveEffects,

    // Logs the current state of the tree.
    dumpTree(rootID = DEFAULT_ROOT_ID) {
      const root = roots.get(rootID);
      const rootContainer = rootContainers.get(rootID);
      if (!root || !rootContainer) {
        // eslint-disable-next-line react-internal/no-production-logging
        console.log("Nothing rendered yet.");
        return;
      }

      const bufferedLog = [];
      function log(...args) {
        bufferedLog.push(...args, "\n");
      }

      function logHostInstances(
        children,
        depth,
      ) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const indent = "  ".repeat(depth);
          if (typeof child.text === "string") {
            log(indent + "- " + child.text);
          } else {
            log(indent + "- " + child.type + "#" + child.id);
            logHostInstances(child.children, depth + 1);
          }
        }
      }
      function logContainer(container, depth) {
        log("  ".repeat(depth) + "- [root#" + container.rootID + "]");
        logHostInstances(container.children, depth + 1);
      }

      function logUpdateQueue(updateQueue, depth) {
        log("  ".repeat(depth + 1) + "QUEUED UPDATES");
        const first = updateQueue.firstBaseUpdate;
        const update = first;
        if (update !== null) {
          do {
            log(
              "  ".repeat(depth + 1) + "~",
              "[" + update.expirationTime + "]",
            );
          } while (update !== null);
        }

        const lastPending = updateQueue.shared.pending;
        if (lastPending !== null) {
          const firstPending = lastPending.next;
          const pendingUpdate = firstPending;
          if (pendingUpdate !== null) {
            do {
              log(
                "  ".repeat(depth + 1) + "~",
                "[" + pendingUpdate.expirationTime + "]",
              );
            } while (pendingUpdate !== null && pendingUpdate !== firstPending);
          }
        }
      }

      function logFiber(fiber, depth) {
        log(
          "  ".repeat(depth) +
            "- " +
            // need to explicitly coerce Symbol to a string
            (fiber.type ? fiber.type.name || fiber.type.toString() : "[root]"),
          "[" +
            fiber.childExpirationTime +
            (fiber.pendingProps ? "*" : "") +
            "]",
        );
        if (fiber.updateQueue) {
          logUpdateQueue(fiber.updateQueue, depth);
        }
        // const childInProgress = fiber.progressedChild;
        // if (childInProgress && childInProgress !== fiber.child) {
        //   log(
        //     '  '.repeat(depth + 1) + 'IN PROGRESS: ' + fiber.pendingWorkPriority,
        //   );
        //   logFiber(childInProgress, depth + 1);
        //   if (fiber.child) {
        //     log('  '.repeat(depth + 1) + 'CURRENT');
        //   }
        // } else if (fiber.child && fiber.updateQueue) {
        //   log('  '.repeat(depth + 1) + 'CHILDREN');
        // }
        if (fiber.child) {
          logFiber(fiber.child, depth + 1);
        }
        if (fiber.sibling) {
          logFiber(fiber.sibling, depth);
        }
      }

      log("HOST INSTANCES:");
      logContainer(rootContainer, 0);
      log("FIBERS:");
      logFiber(root.current, 0);

      // eslint-disable-next-line react-internal/no-production-logging
      console.log(...bufferedLog);
    },

    getRoot(rootID = DEFAULT_ROOT_ID) {
      return roots.get(rootID);
    },
  };

  return ReactNoop;
}

export default createReactNoop;
