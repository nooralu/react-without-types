/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  DefaultLane,
  getHighestPriorityLane,
  IdleLane,
  includesNonIdleWork,
  InputContinuousLane,
  NoLane,
  SyncLane,
} from "./ReactFiberLane";

export const NoEventPriority = NoLane;
export const DiscreteEventPriority = SyncLane;
export const ContinuousEventPriority = InputContinuousLane;
export const DefaultEventPriority = DefaultLane;
export const IdleEventPriority = IdleLane;

export function higherEventPriority(
  a,
  b,
) {
  return a !== 0 && a < b ? a : b;
}

export function lowerEventPriority(
  a,
  b,
) {
  return a === 0 || a > b ? a : b;
}

export function isHigherEventPriority(
  a,
  b,
) {
  return a !== 0 && a < b;
}

export function eventPriorityToLane(updatePriority) {
  return updatePriority;
}

export function lanesToEventPriority(lanes) {
  const lane = getHighestPriorityLane(lanes);
  if (!isHigherEventPriority(DiscreteEventPriority, lane)) {
    return DiscreteEventPriority;
  }
  if (!isHigherEventPriority(ContinuousEventPriority, lane)) {
    return ContinuousEventPriority;
  }
  if (includesNonIdleWork(lane)) {
    return DefaultEventPriority;
  }
  return IdleEventPriority;
}
