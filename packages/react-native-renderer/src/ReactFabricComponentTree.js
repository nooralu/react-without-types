/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict-local
 */

import { getPublicInstance } from "./ReactFiberConfigFabric";

// `node` is typed incorrectly here. The proper type should be `PublicInstance`.
// This is ok in DOM because they types are interchangeable, but in React Native
// they aren't.
function getInstanceFromNode(node) {
  const instance = node; // In React Native, node is never a text instance

  if (
    instance.canonical != null &&
    instance.canonical.internalInstanceHandle != null
  ) {
    return instance.canonical.internalInstanceHandle;
  }

  // $FlowFixMe[incompatible-return] DevTools incorrectly passes a fiber in React Native.
  return node;
}

function getNodeFromInstance(fiber) {
  const publicInstance = getPublicInstance(fiber.stateNode);

  if (publicInstance == null) {
    throw new Error("Could not find host instance from fiber");
  }

  return publicInstance;
}

function getFiberCurrentPropsFromNode(instance) {
  return instance.canonical.currentProps;
}

export {
  getFiberCurrentPropsFromNode,
  getInstanceFromNode,
  getInstanceFromNode as getClosestInstanceFromNode,
  getNodeFromInstance,
};
