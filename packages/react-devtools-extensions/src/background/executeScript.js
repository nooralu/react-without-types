/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
/* global chrome */

export function executeScriptInIsolatedWorld({
  target,
  files,
}) {
  return chrome.scripting.executeScript({
    target,
    files,
    world: chrome.scripting.ExecutionWorld.ISOLATED,
  });
}

export function executeScriptInMainWorld({
  target,
  files,
  injectImmediately,
}) {
  return chrome.scripting.executeScript({
    target,
    files,
    injectImmediately,
    world: chrome.scripting.ExecutionWorld.MAIN,
  });
}
