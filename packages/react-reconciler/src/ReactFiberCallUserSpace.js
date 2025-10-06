/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isRendering, setIsRendering } from "./ReactCurrentFiber";
import { captureCommitPhaseError } from "./ReactFiberWorkLoop";

// These indirections exists so we can exclude its stack frame in DEV (and anything below it).
// TODO: Consider marking the whole bundle instead of these boundaries.

const callComponent = {
  react_stack_bottom_frame: function (
    Component,
    props,
    secondArg,
  ) {
    const wasRendering = isRendering;
    setIsRendering(true);
    try {
      const result = Component(props, secondArg);
      return result;
    } finally {
      setIsRendering(wasRendering);
    }
  },
};

export const callComponentInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callComponent.react_stack_bottom_frame.bind(callComponent))
  : (null);

const callRender = {
  react_stack_bottom_frame: function (instance) {
    const wasRendering = isRendering;
    setIsRendering(true);
    try {
      const result = instance.render();
      return result;
    } finally {
      setIsRendering(wasRendering);
    }
  },
};

export const callRenderInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callRender.react_stack_bottom_frame.bind(callRender))
  : (null);

const callComponentDidMount = {
  react_stack_bottom_frame: function (
    finishedWork,
    instance,
  ) {
    try {
      instance.componentDidMount();
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error);
    }
  },
};

export const callComponentDidMountInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callComponentDidMount.react_stack_bottom_frame.bind(
    callComponentDidMount,
  ))
  : (null);

const callComponentDidUpdate = {
  react_stack_bottom_frame: function (
    finishedWork,
    instance,
    prevProps,
    prevState,
    snapshot,
  ) {
    try {
      instance.componentDidUpdate(prevProps, prevState, snapshot);
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error);
    }
  },
};

export const callComponentDidUpdateInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callComponentDidUpdate.react_stack_bottom_frame.bind(
    callComponentDidUpdate,
  ))
  : (null);

const callComponentDidCatch = {
  react_stack_bottom_frame: function (
    instance,
    errorInfo,
  ) {
    const error = errorInfo.value;
    const stack = errorInfo.stack;
    instance.componentDidCatch(error, {
      componentStack: stack !== null ? stack : "",
    });
  },
};

export const callComponentDidCatchInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callComponentDidCatch.react_stack_bottom_frame.bind(
    callComponentDidCatch,
  ))
  : (null);

const callComponentWillUnmount = {
  react_stack_bottom_frame: function (
    current,
    nearestMountedAncestor,
    instance,
  ) {
    try {
      instance.componentWillUnmount();
    } catch (error) {
      captureCommitPhaseError(current, nearestMountedAncestor, error);
    }
  },
};

export const callComponentWillUnmountInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callComponentWillUnmount.react_stack_bottom_frame.bind(
    callComponentWillUnmount,
  ))
  : (null);

const callCreate = {
  react_stack_bottom_frame: function (
    effect,
  ) {
    const create = effect.create;
    const inst = effect.inst;
    const destroy = create();
    inst.destroy = destroy;
    return destroy;
  },
};

export const callCreateInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callCreate.react_stack_bottom_frame.bind(callCreate))
  : (null);

const callDestroy = {
  react_stack_bottom_frame: function (
    current,
    nearestMountedAncestor,
    destroy,
  ) {
    try {
      destroy();
    } catch (error) {
      captureCommitPhaseError(current, nearestMountedAncestor, error);
    }
  },
};

export const callDestroyInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callDestroy.react_stack_bottom_frame.bind(callDestroy))
  : (null);

const callLazyInit = {
  react_stack_bottom_frame: function (lazy) {
    const payload = lazy._payload;
    const init = lazy._init;
    return init(payload);
  },
};

export const callLazyInitInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callLazyInit.react_stack_bottom_frame.bind(callLazyInit))
  : (null);
