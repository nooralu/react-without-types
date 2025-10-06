/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// DEV-only global reference to the currently executing task
export let currentTaskInDEV = null;

export function setCurrentTaskInDEV(task) {
  if (__DEV__) {
    currentTaskInDEV = task;
  }
}
