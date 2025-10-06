/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  getChildHostContext,
  getRootHostContext,
  HostTransitionContext,
  isPrimaryRenderer,
  NotPendingTransition,
} from "./ReactFiberConfig";
import { createCursor, pop, push } from "./ReactFiberStack";

const contextStackCursor = createCursor(null);
const contextFiberStackCursor = createCursor(null);
const rootInstanceStackCursor = createCursor(null);

// Represents the nearest host transition provider (in React DOM, a <form />)
// NOTE: Since forms cannot be nested, and this feature is only implemented by
// React DOM, we don't technically need this to be a stack. It could be a single
// module variable instead.
const hostTransitionProviderCursor = createCursor(null);

function requiredContext(c) {
  if (__DEV__) {
    if (c === null) {
      console.error(
        "Expected host context to exist. This error is likely caused by a bug " +
          "in React. Please file an issue.",
      );
    }
  }
  return c;
}

function getCurrentRootHostContainer() {
  return rootInstanceStackCursor.current;
}

function getRootHostContainer() {
  const rootInstance = requiredContext(rootInstanceStackCursor.current);
  return rootInstance;
}

export function getHostTransitionProvider() {
  return hostTransitionProviderCursor.current;
}

function pushHostContainer(fiber, nextRootInstance) {
  // Push current root instance onto the stack;
  // This allows us to reset root when portals are popped.
  push(rootInstanceStackCursor, nextRootInstance, fiber);
  // Track the context and the Fiber that provided it.
  // This enables us to pop only Fibers that provide unique contexts.
  push(contextFiberStackCursor, fiber, fiber);

  // Finally, we need to push the host context to the stack.
  // However, we can't just call getRootHostContext() and push it because
  // we'd have a different number of entries on the stack depending on
  // whether getRootHostContext() throws somewhere in renderer code or not.
  // So we push an empty value first. This lets us safely unwind on errors.
  push(contextStackCursor, null, fiber);
  const nextRootContext = getRootHostContext(nextRootInstance);
  // Now that we know this function doesn't throw, replace it.
  pop(contextStackCursor, fiber);
  push(contextStackCursor, nextRootContext, fiber);
}

function popHostContainer(fiber) {
  pop(contextStackCursor, fiber);
  pop(contextFiberStackCursor, fiber);
  pop(rootInstanceStackCursor, fiber);
}

function getHostContext() {
  const context = requiredContext(contextStackCursor.current);
  return context;
}

function pushHostContext(fiber) {
  const stateHook = fiber.memoizedState;
  if (stateHook !== null) {
    // Only provide context if this fiber has been upgraded by a host
    // transition. We use the same optimization for regular host context below.
    push(hostTransitionProviderCursor, fiber, fiber);
  }

  const context = requiredContext(contextStackCursor.current);
  const nextContext = getChildHostContext(context, fiber.type);

  // Don't push this Fiber's context unless it's unique.
  if (context !== nextContext) {
    // Track the context and the Fiber that provided it.
    // This enables us to pop only Fibers that provide unique contexts.
    push(contextFiberStackCursor, fiber, fiber);
    push(contextStackCursor, nextContext, fiber);
  }
}

function popHostContext(fiber) {
  if (contextFiberStackCursor.current === fiber) {
    // Do not pop unless this Fiber provided the current context.
    // pushHostContext() only pushes Fibers that provide unique contexts.
    pop(contextStackCursor, fiber);
    pop(contextFiberStackCursor, fiber);
  }

  if (hostTransitionProviderCursor.current === fiber) {
    // Do not pop unless this Fiber provided the current context. This is mostly
    // a performance optimization, but conveniently it also prevents a potential
    // data race where a host provider is upgraded (i.e. memoizedState becomes
    // non-null) during a concurrent event. This is a bit of a flaw in the way
    // we upgrade host components, but because we're accounting for it here, it
    // should be fine.
    pop(hostTransitionProviderCursor, fiber);

    // When popping the transition provider, we reset the context value back
    // to `NotPendingTransition`. We can do this because you're not allowed to nest forms. If
    // we allowed for multiple nested host transition providers, then we'd
    // need to reset this to the parent provider's status.
    if (isPrimaryRenderer) {
      HostTransitionContext._currentValue = NotPendingTransition;
    } else {
      HostTransitionContext._currentValue2 = NotPendingTransition;
    }
  }
}

export {
  getCurrentRootHostContainer,
  getHostContext,
  getRootHostContainer,
  popHostContainer,
  popHostContext,
  pushHostContainer,
  pushHostContext,
};
