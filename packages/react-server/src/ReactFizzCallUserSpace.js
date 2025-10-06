/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// These indirections exists so we can exclude its stack frame in DEV (and anything below it).
// TODO: Consider marking the whole bundle instead of these boundaries.

const callComponent = {
  react_stack_bottom_frame: function (
    Component,
    props,
    secondArg,
  ) {
    return Component(props, secondArg);
  },
};

export const callComponentInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callComponent.react_stack_bottom_frame.bind(callComponent))
  : (null);

const callRender = {
  react_stack_bottom_frame: function (instance) {
    return instance.render();
  },
};

export const callRenderInDEV = __DEV__
  // We use this technique to trick minifiers to preserve the function name.
  ? (callRender.react_stack_bottom_frame.bind(callRender))
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
