/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  includesBlockingLane,
  includesTransitionLane,
  isBlockingLane,
  isGestureRender,
  isTransitionLane,
  NoLanes,
} from "./ReactFiberLane";

import { resolveEventTimeStamp, resolveEventType } from "./ReactFiberConfig";

import {
  enableComponentPerformanceTrack,
  enableProfilerCommitHooks,
  enableProfilerNestedUpdatePhase,
  enableProfilerTimer,
} from "shared/ReactFeatureFlags";

import getComponentNameFromFiber from "./getComponentNameFromFiber";
import { isAlreadyRendering } from "./ReactFiberWorkLoop";

// Intentionally not named imports because Rollup would use dynamic dispatch for
// CommonJS interop named imports.
import * as Scheduler from "scheduler";

const { unstable_now: now } = Scheduler;

const createTask =
  // eslint-disable-next-line react-internal/no-production-logging
  __DEV__ && console.createTask
    // eslint-disable-next-line react-internal/no-production-logging
    ? console.createTask
    : (name) => null;

export const REGULAR_UPDATE = 0;
export const SPAWNED_UPDATE = 1;
export const PINGED_UPDATE = 2;

export let renderStartTime = -0;
export let commitStartTime = -0;
export let commitEndTime = -0;
export let commitErrors = null;
export let profilerStartTime = -1.1;
export let profilerEffectDuration = -0;
export let componentEffectDuration = -0;
export let componentEffectStartTime = -1.1;
export let componentEffectEndTime = -1.1;
export let componentEffectErrors = null;
export let componentEffectSpawnedUpdate = false;

export let blockingClampTime = -0;
export let blockingUpdateTime = -1.1; // First sync setState scheduled.
export let blockingUpdateTask = null; // First sync setState's stack trace.
export let blockingUpdateType = 0;
export let blockingUpdateMethodName = null; // The name of the method that caused first sync update.
export let blockingUpdateComponentName = null; // The name of the component where first sync update happened.
export let blockingEventTime = -1.1; // Event timeStamp of the first setState.
export let blockingEventType = null; // Event type of the first setState.
export let blockingEventRepeatTime = -1.1;
export let blockingSuspendedTime = -1.1;

export let gestureClampTime = -0;
export let gestureUpdateTime = -1.1; // First setOptimistic scheduled inside startGestureTransition.
export let gestureUpdateTask = null; // First sync setState's stack trace.
export let gestureUpdateType = 0;
export let gestureUpdateMethodName = null; // The name of the method that caused first gesture update.
export let gestureUpdateComponentName = null; // The name of the component where first gesture update happened.
export let gestureEventTime = -1.1; // Event timeStamp of the first setState.
export let gestureEventType = null; // Event type of the first setState.
export let gestureEventRepeatTime = -1.1;
export let gestureSuspendedTime = -1.1;

// TODO: This should really be one per Transition lane.
export let transitionClampTime = -0;
export let transitionStartTime = -1.1; // First startTransition call before setState.
export let transitionUpdateTime = -1.1; // First transition setState scheduled.
export let transitionUpdateType = 0;
export let transitionUpdateTask = null; // First transition setState's stack trace.
export let transitionUpdateMethodName = null; // The name of the method that caused first transition update.
export let transitionUpdateComponentName = null; // The name of the component where first transition update happened.
export let transitionEventTime = -1.1; // Event timeStamp of the first transition.
export let transitionEventType = null; // Event type of the first transition.
export let transitionEventRepeatTime = -1.1;
export let transitionSuspendedTime = -1.1;

export let retryClampTime = -0;
export let idleClampTime = -0;

export let animatingLanes = NoLanes;
export let animatingTask = null; // First ViewTransition applying an Animation.

export let yieldReason = 0;
export let yieldStartTime = -1.1; // The time when we yielded to the event loop

export function startYieldTimer(reason) {
  if (!enableProfilerTimer || !enableComponentPerformanceTrack) {
    return;
  }
  yieldStartTime = now();
  yieldReason = reason;
}

export function startUpdateTimerByLane(
  lane,
  method,
  fiber,
) {
  if (!enableProfilerTimer || !enableComponentPerformanceTrack) {
    return;
  }
  if (isGestureRender(lane)) {
    if (gestureUpdateTime < 0) {
      gestureUpdateTime = now();
      gestureUpdateTask = createTask(method);
      gestureUpdateMethodName = method;
      if (__DEV__ && fiber != null) {
        gestureUpdateComponentName = getComponentNameFromFiber(fiber);
      }
      const newEventTime = resolveEventTimeStamp();
      const newEventType = resolveEventType();
      if (
        newEventTime !== gestureEventRepeatTime ||
        newEventType !== gestureEventType
      ) {
        gestureEventRepeatTime = -1.1;
      }
      gestureEventTime = newEventTime;
      gestureEventType = newEventType;
    }
  } else if (isBlockingLane(lane)) {
    if (blockingUpdateTime < 0) {
      blockingUpdateTime = now();
      blockingUpdateTask = createTask(method);
      blockingUpdateMethodName = method;
      if (__DEV__ && fiber != null) {
        blockingUpdateComponentName = getComponentNameFromFiber(fiber);
      }
      if (isAlreadyRendering()) {
        componentEffectSpawnedUpdate = true;
        blockingUpdateType = SPAWNED_UPDATE;
      }
      const newEventTime = resolveEventTimeStamp();
      const newEventType = resolveEventType();
      if (
        newEventTime !== blockingEventRepeatTime ||
        newEventType !== blockingEventType
      ) {
        blockingEventRepeatTime = -1.1;
      } else if (newEventType !== null) {
        // If this is a second update in the same event, we treat it as a spawned update.
        // This might be a microtask spawned from useEffect, multiple flushSync or
        // a setState in a microtask spawned after the first setState. Regardless it's bad.
        blockingUpdateType = SPAWNED_UPDATE;
      }
      blockingEventTime = newEventTime;
      blockingEventType = newEventType;
    }
  } else if (isTransitionLane(lane)) {
    if (transitionUpdateTime < 0) {
      transitionUpdateTime = now();
      transitionUpdateTask = createTask(method);
      transitionUpdateMethodName = method;
      if (__DEV__ && fiber != null) {
        transitionUpdateComponentName = getComponentNameFromFiber(fiber);
      }
      if (transitionStartTime < 0) {
        const newEventTime = resolveEventTimeStamp();
        const newEventType = resolveEventType();
        if (
          newEventTime !== transitionEventRepeatTime ||
          newEventType !== transitionEventType
        ) {
          transitionEventRepeatTime = -1.1;
        }
        transitionEventTime = newEventTime;
        transitionEventType = newEventType;
      }
    }
  }
}

export function startHostActionTimer(fiber) {
  if (!enableProfilerTimer || !enableComponentPerformanceTrack) {
    return;
  }
  // This schedules an update on both the blocking lane for the pending state and on the
  // transition lane for the action update. Using the debug task from the host fiber.
  if (blockingUpdateTime < 0) {
    blockingUpdateTime = now();
    blockingUpdateTask = __DEV__ && fiber._debugTask != null
      ? fiber._debugTask
      : null;
    if (isAlreadyRendering()) {
      blockingUpdateType = SPAWNED_UPDATE;
    }
    const newEventTime = resolveEventTimeStamp();
    const newEventType = resolveEventType();
    if (
      newEventTime !== blockingEventRepeatTime ||
      newEventType !== blockingEventType
    ) {
      blockingEventRepeatTime = -1.1;
    } else if (newEventType !== null) {
      // If this is a second update in the same event, we treat it as a spawned update.
      // This might be a microtask spawned from useEffect, multiple flushSync or
      // a setState in a microtask spawned after the first setState. Regardless it's bad.
      blockingUpdateType = SPAWNED_UPDATE;
    }
    blockingEventTime = newEventTime;
    blockingEventType = newEventType;
  }
  if (transitionUpdateTime < 0) {
    transitionUpdateTime = now();
    transitionUpdateTask = __DEV__ && fiber._debugTask != null
      ? fiber._debugTask
      : null;
    if (transitionStartTime < 0) {
      const newEventTime = resolveEventTimeStamp();
      const newEventType = resolveEventType();
      if (
        newEventTime !== transitionEventRepeatTime ||
        newEventType !== transitionEventType
      ) {
        transitionEventRepeatTime = -1.1;
      }
      transitionEventTime = newEventTime;
      transitionEventType = newEventType;
    }
  }
}

export function startPingTimerByLanes(lanes) {
  if (!enableProfilerTimer || !enableComponentPerformanceTrack) {
    return;
  }
  // Mark the update time and clamp anything before it because we don't want
  // to show the event time for pings but we also don't want to clear it
  // because we still need to track if this was a repeat.
  if (isGestureRender(lanes)) {
    if (gestureUpdateTime < 0) {
      gestureClampTime = gestureUpdateTime = now();
      gestureUpdateTask = createTask("Promise Resolved");
      gestureUpdateType = PINGED_UPDATE;
    }
  } else if (includesBlockingLane(lanes)) {
    if (blockingUpdateTime < 0) {
      blockingClampTime = blockingUpdateTime = now();
      blockingUpdateTask = createTask("Promise Resolved");
      blockingUpdateType = PINGED_UPDATE;
    }
  } else if (includesTransitionLane(lanes)) {
    if (transitionUpdateTime < 0) {
      transitionClampTime = transitionUpdateTime = now();
      transitionUpdateTask = createTask("Promise Resolved");
      transitionUpdateType = PINGED_UPDATE;
    }
  }
}

export function trackSuspendedTime(lanes, renderEndTime) {
  if (!enableProfilerTimer || !enableComponentPerformanceTrack) {
    return;
  }
  if (isGestureRender(lanes)) {
    gestureSuspendedTime = renderEndTime;
  } else if (includesBlockingLane(lanes)) {
    blockingSuspendedTime = renderEndTime;
  } else if (includesTransitionLane(lanes)) {
    transitionSuspendedTime = renderEndTime;
  }
}

export function clearBlockingTimers() {
  blockingUpdateTime = -1.1;
  blockingUpdateType = 0;
  blockingUpdateMethodName = null;
  blockingUpdateComponentName = null;
  blockingSuspendedTime = -1.1;
  blockingEventRepeatTime = blockingEventTime;
  blockingEventTime = -1.1;
  blockingClampTime = now();
}

export function startAsyncTransitionTimer() {
  if (!enableProfilerTimer || !enableComponentPerformanceTrack) {
    return;
  }
  if (transitionStartTime < 0 && transitionUpdateTime < 0) {
    transitionStartTime = now();
    const newEventTime = resolveEventTimeStamp();
    const newEventType = resolveEventType();
    if (
      newEventTime !== transitionEventRepeatTime ||
      newEventType !== transitionEventType
    ) {
      transitionEventRepeatTime = -1.1;
    }
    transitionEventTime = newEventTime;
    transitionEventType = newEventType;
  }
}

export function hasScheduledTransitionWork() {
  // If we have setState on a transition or scheduled useActionState update.
  return transitionUpdateTime > -1;
}

export function clearAsyncTransitionTimer() {
  transitionStartTime = -1.1;
}

export function clearTransitionTimers() {
  transitionStartTime = -1.1;
  transitionUpdateTime = -1.1;
  transitionUpdateType = 0;
  transitionSuspendedTime = -1.1;
  transitionEventRepeatTime = transitionEventTime;
  transitionEventTime = -1.1;
  transitionClampTime = now();
}

export function hasScheduledGestureTransitionWork() {
  // If we have call setOptimistic on a gesture
  return gestureUpdateTime > -1;
}

export function clearGestureTimers() {
  gestureUpdateTime = -1.1;
  gestureUpdateType = 0;
  gestureSuspendedTime = -1.1;
  gestureEventRepeatTime = gestureEventTime;
  gestureEventTime = -1.1;
  gestureClampTime = now();
}

export function clearGestureUpdates() {
  // Same as clearGestureTimers but doesn't reset the clamp time because we didn't
  // actually emit a render.
  gestureUpdateTime = -1.1;
  gestureUpdateType = 0;
  gestureSuspendedTime = -1.1;
  gestureEventRepeatTime = gestureEventTime;
  gestureEventTime = -1.1;
}

export function clampBlockingTimers(finalTime) {
  if (!enableProfilerTimer || !enableComponentPerformanceTrack) {
    return;
  }
  // If we had new updates come in while we were still rendering or committing, we don't want
  // those update times to create overlapping tracks in the performance timeline so we clamp
  // them to the end of the commit phase.
  blockingClampTime = finalTime;
}

export function clampGestureTimers(finalTime) {
  if (!enableProfilerTimer || !enableComponentPerformanceTrack) {
    return;
  }
  // If we had new updates come in while we were still rendering or committing, we don't want
  // those update times to create overlapping tracks in the performance timeline so we clamp
  // them to the end of the commit phase.
  gestureClampTime = finalTime;
}

export function clampTransitionTimers(finalTime) {
  if (!enableProfilerTimer || !enableComponentPerformanceTrack) {
    return;
  }
  // If we had new updates come in while we were still rendering or committing, we don't want
  // those update times to create overlapping tracks in the performance timeline so we clamp
  // them to the end of the commit phase.
  transitionClampTime = finalTime;
}

export function clampRetryTimers(finalTime) {
  if (!enableProfilerTimer || !enableComponentPerformanceTrack) {
    return;
  }
  retryClampTime = finalTime;
}

export function clampIdleTimers(finalTime) {
  if (!enableProfilerTimer || !enableComponentPerformanceTrack) {
    return;
  }
  idleClampTime = finalTime;
}

export function pushNestedEffectDurations() {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return 0;
  }
  const prevEffectDuration = profilerEffectDuration;
  profilerEffectDuration = 0; // Reset counter.
  return prevEffectDuration;
}

export function popNestedEffectDurations(prevEffectDuration) {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return 0;
  }
  const elapsedTime = profilerEffectDuration;
  profilerEffectDuration = prevEffectDuration;
  return elapsedTime;
}

// Like pop but it also adds the current elapsed time to the parent scope.
export function bubbleNestedEffectDurations(
  prevEffectDuration,
) {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return 0;
  }
  const elapsedTime = profilerEffectDuration;
  profilerEffectDuration += prevEffectDuration;
  return elapsedTime;
}

export function resetComponentEffectTimers() {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return;
  }
  componentEffectStartTime = -1.1;
  componentEffectEndTime = -1.1;
}

export function pushComponentEffectStart() {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return 0;
  }
  const prevEffectStart = componentEffectStartTime;
  componentEffectStartTime = -1.1; // Track the next start.
  return prevEffectStart;
}

export function popComponentEffectStart(prevEffectStart) {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return;
  }
  // If the parent component didn't have a start time, we let this current time persist.
  if (prevEffectStart >= 0) {
    // Otherwise, we restore the previous parent's start time.
    componentEffectStartTime = prevEffectStart;
  }
}

export function pushComponentEffectDuration() {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return 0;
  }
  const prevEffectDuration = componentEffectDuration;
  componentEffectDuration = -0; // Reset component level duration.
  return prevEffectDuration;
}

export function popComponentEffectDuration(prevEffectDuration) {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return;
  }
  // If the parent component didn't have a start time, we let this current time persist.
  if (prevEffectDuration >= 0) {
    // Otherwise, we restore the previous parent's start time.
    componentEffectDuration = prevEffectDuration;
  }
}

export function pushComponentEffectErrors() {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return null;
  }
  const prevErrors = componentEffectErrors;
  componentEffectErrors = null;
  return prevErrors;
}

export function popComponentEffectErrors(
  prevErrors,
) {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return;
  }
  componentEffectErrors = prevErrors;
}

export function pushComponentEffectDidSpawnUpdate() {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return false;
  }

  const prev = componentEffectSpawnedUpdate;
  componentEffectSpawnedUpdate = false; // Reset.
  return prev;
}

export function popComponentEffectDidSpawnUpdate(previousValue) {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return;
  }

  componentEffectSpawnedUpdate = previousValue;
}

/**
 * Tracks whether the current update was a nested/cascading update (scheduled from a layout effect).
 *
 * The overall sequence is:
 *   1. render
 *   2. commit (and call `onRender`, `onCommit`)
 *   3. check for nested updates
 *   4. flush passive effects (and call `onPostCommit`)
 *
 * Nested updates are identified in step 3 above,
 * but step 4 still applies to the work that was just committed.
 * We use two flags to track nested updates then:
 * one tracks whether the upcoming update is a nested update,
 * and the other tracks whether the current update was a nested update.
 * The first value gets synced to the second at the start of the render phase.
 */
let currentUpdateIsNested = false;
let nestedUpdateScheduled = false;

export function isCurrentUpdateNested() {
  return currentUpdateIsNested;
}

export function markNestedUpdateScheduled() {
  if (enableProfilerNestedUpdatePhase) {
    nestedUpdateScheduled = true;
  }
}

export function resetNestedUpdateFlag() {
  if (enableProfilerNestedUpdatePhase) {
    currentUpdateIsNested = false;
    nestedUpdateScheduled = false;
  }
}

export function syncNestedUpdateFlag() {
  if (enableProfilerNestedUpdatePhase) {
    currentUpdateIsNested = nestedUpdateScheduled;
    nestedUpdateScheduled = false;
  }
}

export function recordRenderTime() {
  if (!enableProfilerTimer || !enableComponentPerformanceTrack) {
    return;
  }
  renderStartTime = now();
}

export function recordCommitTime() {
  if (!enableProfilerTimer) {
    return;
  }
  commitStartTime = now();
}

export function recordCommitEndTime() {
  if (!enableProfilerTimer) {
    return;
  }
  commitEndTime = now();
}

export function startProfilerTimer(fiber) {
  if (!enableProfilerTimer) {
    return;
  }

  profilerStartTime = now();

  if ((fiber.actualStartTime) < 0) {
    fiber.actualStartTime = profilerStartTime;
  }
}

export function stopProfilerTimerIfRunning(fiber) {
  if (!enableProfilerTimer) {
    return;
  }
  profilerStartTime = -1;
}

export function stopProfilerTimerIfRunningAndRecordDuration(
  fiber,
) {
  if (!enableProfilerTimer) {
    return;
  }

  if (profilerStartTime >= 0) {
    const elapsedTime = now() - profilerStartTime;
    fiber.actualDuration += elapsedTime;
    fiber.selfBaseDuration = elapsedTime;
    profilerStartTime = -1;
  }
}

export function stopProfilerTimerIfRunningAndRecordIncompleteDuration(
  fiber,
) {
  if (!enableProfilerTimer) {
    return;
  }

  if (profilerStartTime >= 0) {
    const elapsedTime = now() - profilerStartTime;
    fiber.actualDuration += elapsedTime;
    // We don't update the selfBaseDuration here because we errored.
    profilerStartTime = -1;
  }
}

export function recordEffectDuration(fiber) {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return;
  }

  if (profilerStartTime >= 0) {
    const endTime = now();
    const elapsedTime = endTime - profilerStartTime;

    profilerStartTime = -1;

    // Store duration on the next nearest Profiler ancestor
    // Or the root (for the DevTools Profiler to read)
    profilerEffectDuration += elapsedTime;
    componentEffectDuration += elapsedTime;

    // Keep track of the last end time of the effects.
    componentEffectEndTime = endTime;
  }
}

export function recordEffectError(errorInfo) {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return;
  }
  if (componentEffectErrors === null) {
    componentEffectErrors = [];
  }
  componentEffectErrors.push(errorInfo);
  if (commitErrors === null) {
    commitErrors = [];
  }
  commitErrors.push(errorInfo);
}

export function resetCommitErrors() {
  commitErrors = null;
}

export function startEffectTimer() {
  if (!enableProfilerTimer || !enableProfilerCommitHooks) {
    return;
  }
  profilerStartTime = now();
  if (componentEffectStartTime < 0) {
    // Keep track of the first time we start an effect as the component's effect start time.
    componentEffectStartTime = profilerStartTime;
  }
}

export function transferActualDuration(fiber) {
  // Transfer time spent rendering these children so we don't lose it
  // after we rerender. This is used as a helper in special cases
  // where we should count the work of multiple passes.
  let child = fiber.child;
  while (child) {
    // $FlowFixMe[unsafe-addition] addition with possible null/undefined value
    fiber.actualDuration += child.actualDuration;
    child = child.sibling;
  }
}

export function startAnimating(lanes) {
  animatingLanes |= lanes;
  animatingTask = null;
}

export function stopAnimating(lanes) {
  animatingLanes &= ~lanes;
  animatingTask = null;
}

export function trackAnimatingTask(task) {
  if (animatingTask === null) {
    animatingTask = task;
  }
}
