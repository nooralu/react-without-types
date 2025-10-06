/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setCurrentOwner } from "./flight/ReactFlightCurrentOwner";

// These indirections exists so we can exclude its stack frame in DEV (and anything below it).
// TODO: Consider marking the whole bundle instead of these boundaries.

const callComponent = {
  react_stack_bottom_frame: function (
    Component,
    props,
    componentDebugInfo,
  ) {
    // The secondArg is always undefined in Server Components since refs error early.
    const secondArg = undefined;
    setCurrentOwner(componentDebugInfo);
    try {
      return Component(props, secondArg);
    } finally {
      setCurrentOwner(null);
    }
  },
};

export const callComponentInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callComponent.react_stack_bottom_frame.bind(callComponent))
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

const callIterator = {
  react_stack_bottom_frame: function (
    iterator,
    progress,
    error,
  ) {
    iterator.next().then(progress, error);
  },
};

export const callIteratorInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callIterator.react_stack_bottom_frame.bind(callIterator))
  : (null);
