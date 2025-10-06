/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  enableDefaultTransitionIndicator,
  enableViewTransition,
} from "shared/ReactFeatureFlags";

export let rootMutationContext = false;
export let viewTransitionMutationContext = false;

export function pushRootMutationContext() {
  if (enableDefaultTransitionIndicator) {
    rootMutationContext = false;
  }
  if (enableViewTransition) {
    viewTransitionMutationContext = false;
  }
}

export function pushMutationContext() {
  if (!enableViewTransition) {
    return false;
  }
  const prev = viewTransitionMutationContext;
  viewTransitionMutationContext = false;
  return prev;
}

export function popMutationContext(prev) {
  if (enableViewTransition) {
    if (viewTransitionMutationContext) {
      rootMutationContext = true;
    }
    viewTransitionMutationContext = prev;
  }
}

export function trackHostMutation() {
  // This is extremely hot function that must be inlined. Don't add more stuff.
  if (enableViewTransition) {
    viewTransitionMutationContext = true;
  } else if (enableDefaultTransitionIndicator) {
    // We only set this if enableViewTransition is not on. Otherwise we track
    // it on the viewTransitionMutationContext and collect it when we pop
    // to avoid more than a single operation in this hot path.
    rootMutationContext = true;
  }
}
