/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readContext as readContextImpl } from "./ReactFizzNewContext";
import { getTreeId } from "./ReactFizzTreeContext";
import {
  createThenableState,
  readPreviousThenable,
  trackUsedThenable,
} from "./ReactFizzThenable";

import {
  makeId,
  NotPendingTransition,
  supportsClientAPIs,
} from "./ReactFizzConfig";
import { createFastHash } from "./ReactServerStreamConfig";

import { enableUseEffectEventHook } from "shared/ReactFeatureFlags";
import is from "shared/objectIs";
import {
  REACT_CONTEXT_TYPE,
  REACT_MEMO_CACHE_SENTINEL,
} from "shared/ReactSymbols";
import { checkAttributeStringCoercion } from "shared/CheckStringCoercion";
import { getFormState } from "./ReactFizzServer";

import noop from "shared/noop";

let currentlyRenderingComponent = null;
let currentlyRenderingTask = null;
let currentlyRenderingRequest = null;
let currentlyRenderingKeyPath = null;
let firstWorkInProgressHook = null;
let workInProgressHook = null;
// Whether the work-in-progress hook is a re-rendered hook
let isReRender = false;
// Whether an update was scheduled during the currently executing render pass.
let didScheduleRenderPhaseUpdate = false;
// Counts the number of useId hooks in this component
let localIdCounter = 0;
// Chunks that should be pushed to the stream once the component
// finishes rendering.
// Counts the number of useActionState calls in this component
let actionStateCounter = 0;
// The index of the useActionState hook that matches the one passed in at the
// root during an MPA navigation, if any.
let actionStateMatchingIndex = -1;
// Counts the number of use(thenable) calls in this component
let thenableIndexCounter = 0;
let thenableState = null;
// Lazily created map of render-phase updates
let renderPhaseUpdates = null;
// Counter to prevent infinite loops.
let numberOfReRenders = 0;
const RE_RENDER_LIMIT = 25;

let isInHookUserCodeInDev = false;

// In DEV, this is the name of the currently executing primitive hook
let currentHookNameInDev;

function resolveCurrentlyRenderingComponent() {
  if (currentlyRenderingComponent === null) {
    throw new Error(
      "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for" +
        " one of the following reasons:\n" +
        "1. You might have mismatching versions of React and the renderer (such as React DOM)\n" +
        "2. You might be breaking the Rules of Hooks\n" +
        "3. You might have more than one copy of React in the same app\n" +
        "See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.",
    );
  }

  if (__DEV__) {
    if (isInHookUserCodeInDev) {
      console.error(
        "Do not call Hooks inside useEffect(...), useMemo(...), or other built-in Hooks. " +
          "You can only call Hooks at the top level of your React function. " +
          "For more information, see " +
          "https://react.dev/link/rules-of-hooks",
      );
    }
  }
  return currentlyRenderingComponent;
}

function areHookInputsEqual(
  nextDeps,
  prevDeps,
) {
  if (prevDeps === null) {
    if (__DEV__) {
      console.error(
        "%s received a final argument during this render, but not during " +
          "the previous render. Even though the final argument is optional, " +
          "its type cannot change between renders.",
        currentHookNameInDev,
      );
    }
    return false;
  }

  if (__DEV__) {
    // Don't bother comparing lengths in prod because these arrays should be
    // passed inline.
    if (nextDeps.length !== prevDeps.length) {
      console.error(
        "The final argument passed to %s changed size between renders. The " +
          "order and size of this array must remain constant.\n\n" +
          "Previous: %s\n" +
          "Incoming: %s",
        currentHookNameInDev,
        `[${nextDeps.join(", ")}]`,
        `[${prevDeps.join(", ")}]`,
      );
    }
  }
  // $FlowFixMe[incompatible-use] found when upgrading Flow
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    if (is(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

function createHook() {
  if (numberOfReRenders > 0) {
    throw new Error("Rendered more hooks than during the previous render");
  }
  return {
    memoizedState: null,
    queue: null,
    next: null,
  };
}

function createWorkInProgressHook() {
  if (workInProgressHook === null) {
    // This is the first hook in the list
    if (firstWorkInProgressHook === null) {
      isReRender = false;
      firstWorkInProgressHook = workInProgressHook = createHook();
    } else {
      // There's already a work-in-progress. Reuse it.
      isReRender = true;
      workInProgressHook = firstWorkInProgressHook;
    }
  } else {
    if (workInProgressHook.next === null) {
      isReRender = false;
      // Append to the end of the list
      workInProgressHook = workInProgressHook.next = createHook();
    } else {
      // There's already a work-in-progress. Reuse it.
      isReRender = true;
      workInProgressHook = workInProgressHook.next;
    }
  }
  return workInProgressHook;
}

export function prepareToUseHooks(
  request,
  task,
  keyPath,
  componentIdentity,
  prevThenableState,
) {
  currentlyRenderingComponent = componentIdentity;
  currentlyRenderingTask = task;
  currentlyRenderingRequest = request;
  currentlyRenderingKeyPath = keyPath;
  if (__DEV__) {
    isInHookUserCodeInDev = false;
  }

  // The following should have already been reset
  // didScheduleRenderPhaseUpdate = false;
  // firstWorkInProgressHook = null;
  // numberOfReRenders = 0;
  // renderPhaseUpdates = null;
  // workInProgressHook = null;

  localIdCounter = 0;
  actionStateCounter = 0;
  actionStateMatchingIndex = -1;
  thenableIndexCounter = 0;
  thenableState = prevThenableState;
}

export function prepareToUseThenableState(
  prevThenableState,
) {
  thenableIndexCounter = 0;
  thenableState = prevThenableState;
}

export function finishHooks(
  Component,
  props,
  children,
  refOrContext,
) {
  // This must be called after every function component to prevent hooks from
  // being used in classes.

  while (didScheduleRenderPhaseUpdate) {
    // Updates were scheduled during the render phase. They are stored in
    // the `renderPhaseUpdates` map. Call the component again, reusing the
    // work-in-progress hooks and applying the additional updates on top. Keep
    // restarting until no more updates are scheduled.
    didScheduleRenderPhaseUpdate = false;
    localIdCounter = 0;
    actionStateCounter = 0;
    actionStateMatchingIndex = -1;
    thenableIndexCounter = 0;
    numberOfReRenders += 1;

    // Start over from the beginning of the list
    workInProgressHook = null;

    children = Component(props, refOrContext);
  }

  resetHooksState();
  return children;
}

export function getThenableStateAfterSuspending() {
  const state = thenableState;
  thenableState = null;
  return state;
}

export function checkDidRenderIdHook() {
  // This should be called immediately after every finishHooks call.
  // Conceptually, it's part of the return value of finishHooks; it's only a
  // separate function to avoid using an array tuple.
  const didRenderIdHook = localIdCounter !== 0;
  return didRenderIdHook;
}

export function getActionStateCount() {
  // This should be called immediately after every finishHooks call.
  // Conceptually, it's part of the return value of finishHooks; it's only a
  // separate function to avoid using an array tuple.
  return actionStateCounter;
}
export function getActionStateMatchingIndex() {
  // This should be called immediately after every finishHooks call.
  // Conceptually, it's part of the return value of finishHooks; it's only a
  // separate function to avoid using an array tuple.
  return actionStateMatchingIndex;
}

// Reset the internal hooks state if an error occurs while rendering a component
export function resetHooksState() {
  if (__DEV__) {
    isInHookUserCodeInDev = false;
  }

  currentlyRenderingComponent = null;
  currentlyRenderingTask = null;
  currentlyRenderingRequest = null;
  currentlyRenderingKeyPath = null;
  didScheduleRenderPhaseUpdate = false;
  firstWorkInProgressHook = null;
  numberOfReRenders = 0;
  renderPhaseUpdates = null;
  workInProgressHook = null;
}

function readContext(context) {
  if (__DEV__) {
    if (isInHookUserCodeInDev) {
      console.error(
        "Context can only be read while React is rendering. " +
          "In classes, you can read it in the render method or getDerivedStateFromProps. " +
          "In function components, you can read it directly in the function body, but not " +
          "inside Hooks like useReducer() or useMemo().",
      );
    }
  }
  return readContextImpl(context);
}

function useContext(context) {
  if (__DEV__) {
    currentHookNameInDev = "useContext";
  }
  resolveCurrentlyRenderingComponent();
  return readContextImpl(context);
}

function basicStateReducer(state, action) {
  // $FlowFixMe[incompatible-use]: Flow doesn't like mixed types
  return typeof action === "function" ? action(state) : action;
}

export function useState(
  initialState,
) {
  if (__DEV__) {
    currentHookNameInDev = "useState";
  }
  return useReducer(
    basicStateReducer,
    // useReducer has a special case to support lazy useState initializers
    initialState,
  );
}

export function useReducer(
  reducer,
  initialArg,
  init,
) {
  if (__DEV__) {
    if (reducer !== basicStateReducer) {
      currentHookNameInDev = "useReducer";
    }
  }
  currentlyRenderingComponent = resolveCurrentlyRenderingComponent();
  workInProgressHook = createWorkInProgressHook();
  if (isReRender) {
    // This is a re-render. Apply the new render phase updates to the previous
    // current hook.
    const queue = workInProgressHook.queue;
    const dispatch = queue.dispatch;
    if (renderPhaseUpdates !== null) {
      // Render phase updates are stored in a map of queue -> linked list
      const firstRenderPhaseUpdate = renderPhaseUpdates.get(queue);
      if (firstRenderPhaseUpdate !== undefined) {
        // $FlowFixMe[incompatible-use] found when upgrading Flow
        renderPhaseUpdates.delete(queue);
        // $FlowFixMe[incompatible-use] found when upgrading Flow
        let newState = workInProgressHook.memoizedState;
        let update = firstRenderPhaseUpdate;
        do {
          // Process this render phase update. We don't have to check the
          // priority because it will always be the same as the current
          // render's.
          const action = update.action;
          if (__DEV__) {
            isInHookUserCodeInDev = true;
          }
          newState = reducer(newState, action);
          if (__DEV__) {
            isInHookUserCodeInDev = false;
          }
          // $FlowFixMe[incompatible-type] we bail out when we get a null
          update = update.next;
        } while (update !== null);

        // $FlowFixMe[incompatible-use] found when upgrading Flow
        workInProgressHook.memoizedState = newState;

        return [newState, dispatch];
      }
    }
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    return [workInProgressHook.memoizedState, dispatch];
  } else {
    if (__DEV__) {
      isInHookUserCodeInDev = true;
    }
    let initialState;
    if (reducer === basicStateReducer) {
      // Special case for `useState`.
      initialState = typeof initialArg === "function"
        ? initialArg()
        : initialArg;
    } else {
      initialState = init !== undefined ? init(initialArg) : initialArg;
    }
    if (__DEV__) {
      isInHookUserCodeInDev = false;
    }
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    workInProgressHook.memoizedState = initialState;
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    const queue = (workInProgressHook.queue = {
      last: null,
      dispatch: null,
    });
    const dispatch = (queue.dispatch = dispatchAction.bind(
      null,
      currentlyRenderingComponent,
      queue,
    ));
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    return [workInProgressHook.memoizedState, dispatch];
  }
}

function useMemo(nextCreate, deps) {
  currentlyRenderingComponent = resolveCurrentlyRenderingComponent();
  workInProgressHook = createWorkInProgressHook();

  const nextDeps = deps === undefined ? null : deps;

  if (workInProgressHook !== null) {
    const prevState = workInProgressHook.memoizedState;
    if (prevState !== null) {
      if (nextDeps !== null) {
        const prevDeps = prevState[1];
        if (areHookInputsEqual(nextDeps, prevDeps)) {
          return prevState[0];
        }
      }
    }
  }

  if (__DEV__) {
    isInHookUserCodeInDev = true;
  }
  const nextValue = nextCreate();
  if (__DEV__) {
    isInHookUserCodeInDev = false;
  }
  // $FlowFixMe[incompatible-use] found when upgrading Flow
  workInProgressHook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function useRef(initialValue) {
  currentlyRenderingComponent = resolveCurrentlyRenderingComponent();
  workInProgressHook = createWorkInProgressHook();
  const previousRef = workInProgressHook.memoizedState;
  if (previousRef === null) {
    const ref = { current: initialValue };
    if (__DEV__) {
      Object.seal(ref);
    }
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    workInProgressHook.memoizedState = ref;
    return ref;
  } else {
    return previousRef;
  }
}

function dispatchAction(
  componentIdentity,
  queue,
  action,
) {
  if (numberOfReRenders >= RE_RENDER_LIMIT) {
    throw new Error(
      "Too many re-renders. React limits the number of renders to prevent " +
        "an infinite loop.",
    );
  }

  if (componentIdentity === currentlyRenderingComponent) {
    // This is a render phase update. Stash it in a lazily-created map of
    // queue -> linked list of updates. After this render pass, we'll restart
    // and apply the stashed updates on top of the work-in-progress hook.
    didScheduleRenderPhaseUpdate = true;
    const update = {
      action,
      next: null,
    };
    if (renderPhaseUpdates === null) {
      renderPhaseUpdates = new Map();
    }
    const firstRenderPhaseUpdate = renderPhaseUpdates.get(queue);
    if (firstRenderPhaseUpdate === undefined) {
      // $FlowFixMe[incompatible-use] found when upgrading Flow
      renderPhaseUpdates.set(queue, update);
    } else {
      // Append the update to the end of the list.
      let lastRenderPhaseUpdate = firstRenderPhaseUpdate;
      while (lastRenderPhaseUpdate.next !== null) {
        lastRenderPhaseUpdate = lastRenderPhaseUpdate.next;
      }
      lastRenderPhaseUpdate.next = update;
    }
  } else {
    // This means an update has happened after the function component has
    // returned. On the server this is a no-op. In React Fiber, the update
    // would be scheduled for a future render.
  }
}

export function useCallback(
  callback,
  deps,
) {
  return useMemo(() => callback, deps);
}

function throwOnUseEffectEventCall() {
  throw new Error(
    "A function wrapped in useEffectEvent can't be called during rendering.",
  );
}

export function useEffectEvent(
  callback,
) {
  // $FlowIgnore[incompatible-return]
  return throwOnUseEffectEventCall;
}

function useSyncExternalStore(
  subscribe,
  getSnapshot,
  getServerSnapshot,
) {
  if (getServerSnapshot === undefined) {
    throw new Error(
      "Missing getServerSnapshot, which is required for " +
        "server-rendered content. Will revert to client rendering.",
    );
  }
  return getServerSnapshot();
}

function useDeferredValue(value, initialValue) {
  resolveCurrentlyRenderingComponent();
  return initialValue !== undefined ? initialValue : value;
}

function unsupportedStartTransition() {
  throw new Error("startTransition cannot be called during server rendering.");
}

function useTransition() {
  resolveCurrentlyRenderingComponent();
  return [false, unsupportedStartTransition];
}

function useHostTransitionStatus() {
  resolveCurrentlyRenderingComponent();
  return NotPendingTransition;
}

function unsupportedSetOptimisticState() {
  throw new Error("Cannot update optimistic state while rendering.");
}

function useOptimistic(
  passthrough,
  reducer,
) {
  resolveCurrentlyRenderingComponent();
  return [passthrough, unsupportedSetOptimisticState];
}

function createPostbackActionStateKey(
  permalink,
  componentKeyPath,
  hookIndex,
) {
  if (permalink !== undefined) {
    // Don't bother to hash a permalink-based key since it's already short.
    return "p" + permalink;
  } else {
    // Append a node to the key path that represents the form state hook.
    const keyPath = [componentKeyPath, null, hookIndex];
    // Key paths are hashed to reduce the size. It does not need to be secure,
    // and it's more important that it's fast than that it's completely
    // collision-free.
    const keyPathHash = createFastHash(JSON.stringify(keyPath));
    return "k" + keyPathHash;
  }
}

function useActionState(
  action,
  initialState,
  permalink,
) {
  resolveCurrentlyRenderingComponent();

  // Count the number of useActionState hooks per component. We also use this to
  // track the position of this useActionState hook relative to the other ones in
  // this component, so we can generate a unique key for each one.
  const actionStateHookIndex = actionStateCounter++;
  const request = currentlyRenderingRequest;

  // $FlowIgnore[prop-missing]
  const formAction = action.$$FORM_ACTION;
  if (typeof formAction === "function") {
    // This is a server action. These have additional features to enable
    // MPA-style form submissions with progressive enhancement.

    // TODO: If the same permalink is passed to multiple useActionStates, and
    // they all have the same action signature, Fizz will pass the postback
    // state to all of them. We should probably only pass it to the first one,
    // and/or warn.

    // The key is lazily generated and deduped so the that the keypath doesn't
    // get JSON.stringify-ed unnecessarily, and at most once.
    let nextPostbackStateKey = null;

    // Determine the current form state. If we received state during an MPA form
    // submission, then we will reuse that, if the action identity matches.
    // Otherwise, we'll use the initial state argument. We will emit a comment
    // marker into the stream that indicates whether the state was reused.
    let state = initialState;
    const componentKeyPath = currentlyRenderingKeyPath;
    const postbackActionState = getFormState(request);
    // $FlowIgnore[prop-missing]
    const isSignatureEqual = action.$$IS_SIGNATURE_EQUAL;
    if (
      postbackActionState !== null &&
      typeof isSignatureEqual === "function"
    ) {
      const postbackKey = postbackActionState[1];
      const postbackReferenceId = postbackActionState[2];
      const postbackBoundArity = postbackActionState[3];
      if (
        isSignatureEqual.call(action, postbackReferenceId, postbackBoundArity)
      ) {
        nextPostbackStateKey = createPostbackActionStateKey(
          permalink,
          componentKeyPath,
          actionStateHookIndex,
        );
        if (postbackKey === nextPostbackStateKey) {
          // This was a match
          actionStateMatchingIndex = actionStateHookIndex;
          // Reuse the state that was submitted by the form.
          state = postbackActionState[0];
        }
      }
    }

    // Bind the state to the first argument of the action.
    const boundAction = action.bind(null, state);

    // Wrap the action so the return value is void.
    const dispatch = (payload) => {
      boundAction(payload);
    };

    // $FlowIgnore[prop-missing]
    if (typeof boundAction.$$FORM_ACTION === "function") {
      // $FlowIgnore[prop-missing]
      dispatch.$$FORM_ACTION = (prefix) => {
        const metadata = boundAction.$$FORM_ACTION(prefix);

        // Override the action URL
        if (permalink !== undefined) {
          if (__DEV__) {
            checkAttributeStringCoercion(permalink, "target");
          }
          permalink += "";
          metadata.action = permalink;
        }

        const formData = metadata.data;
        if (formData) {
          if (nextPostbackStateKey === null) {
            nextPostbackStateKey = createPostbackActionStateKey(
              permalink,
              componentKeyPath,
              actionStateHookIndex,
            );
          }
          formData.append("$ACTION_KEY", nextPostbackStateKey);
        }
        return metadata;
      };
    }

    return [state, dispatch, false];
  } else {
    // This is not a server action, so the implementation is much simpler.

    // Bind the state to the first argument of the action.
    const boundAction = action.bind(null, initialState);
    // Wrap the action so the return value is void.
    const dispatch = (payload) => {
      boundAction(payload);
    };
    return [initialState, dispatch, false];
  }
}

function useId() {
  const task = currentlyRenderingTask;
  const treeId = getTreeId(task.treeContext);

  const resumableState = currentResumableState;
  if (resumableState === null) {
    throw new Error(
      "Invalid hook call. Hooks can only be called inside of the body of a function component.",
    );
  }

  const localId = localIdCounter++;
  return makeId(resumableState, treeId, localId);
}

function use(usable) {
  if (usable !== null && typeof usable === "object") {
    // $FlowFixMe[method-unbinding]
    if (typeof usable.then === "function") {
      // This is a thenable.
      const thenable = usable;
      return unwrapThenable(thenable);
    } else if (usable.$$typeof === REACT_CONTEXT_TYPE) {
      const context = usable;
      return readContext(context);
    }
  }

  // eslint-disable-next-line react-internal/safe-string-coercion
  throw new Error("An unsupported type was passed to use(): " + String(usable));
}

export function unwrapThenable(thenable) {
  const index = thenableIndexCounter;
  thenableIndexCounter += 1;
  if (thenableState === null) {
    thenableState = createThenableState();
  }
  return trackUsedThenable(thenableState, thenable, index);
}

export function readPreviousThenableFromState() {
  const index = thenableIndexCounter;
  thenableIndexCounter += 1;
  if (thenableState === null) {
    return undefined;
  }
  return readPreviousThenable(thenableState, index);
}

function unsupportedRefresh() {
  throw new Error("Cache cannot be refreshed during server rendering.");
}

function useCacheRefresh() {
  return unsupportedRefresh;
}

function useMemoCache(size) {
  const data = new Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = REACT_MEMO_CACHE_SENTINEL;
  }
  return data;
}

function clientHookNotSupported() {
  throw new Error(
    "Cannot use state or effect Hooks in renderToHTML because " +
      "this component will never be hydrated.",
  );
}

export const HooksDispatcher = supportsClientAPIs
  ? {
    readContext,
    use,
    useContext,
    useMemo,
    useReducer,
    useRef,
    useState,
    useInsertionEffect: noop,
    useLayoutEffect: noop,
    useCallback,
    // useImperativeHandle is not run in the server environment
    useImperativeHandle: noop,
    // Effects are not run in the server environment.
    useEffect: noop,
    // Debugging effect
    useDebugValue: noop,
    useDeferredValue,
    useTransition,
    useId,
    // Subscriptions are not setup in a server environment.
    useSyncExternalStore,
    useOptimistic,
    useActionState,
    useFormState: useActionState,
    useHostTransitionStatus,
    useMemoCache,
    useCacheRefresh,
  }
  : {
    readContext,
    use,
    useCallback,
    useContext,
    useEffect: clientHookNotSupported,
    useImperativeHandle: clientHookNotSupported,
    useInsertionEffect: clientHookNotSupported,
    useLayoutEffect: clientHookNotSupported,
    useMemo,
    useReducer: clientHookNotSupported,
    useRef: clientHookNotSupported,
    useState: clientHookNotSupported,
    useDebugValue: noop,
    useDeferredValue: clientHookNotSupported,
    useTransition: clientHookNotSupported,
    useSyncExternalStore: clientHookNotSupported,
    useId,
    useHostTransitionStatus,
    useFormState: useActionState,
    useActionState,
    useOptimistic,
    useMemoCache,
    useCacheRefresh,
  };

if (enableUseEffectEventHook) {
  HooksDispatcher.useEffectEvent = useEffectEvent;
}

export let currentResumableState = null;
export function setCurrentResumableState(
  resumableState,
) {
  currentResumableState = resumableState;
}
