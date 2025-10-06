/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export * from "../ReactServerStreamConfigFB";

export function scheduleMicrotask(callback) {
  // We don't schedule work in this model, and instead expect performWork to always be called repeatedly.
}

export function scheduleWork(callback) {
  // We don't schedule work in this model, and instead expect performWork to always be called repeatedly.
}
