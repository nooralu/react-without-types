/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isReactNativeEnvironment } from "react-devtools-shared/src/backend/utils";

import Overlay from "./Overlay";

const SHOW_DURATION = 2000;

let timeoutID = null;
let overlay = null;

function hideOverlayNative(agent) {
  agent.emit("hideNativeHighlight");
}

function hideOverlayWeb() {
  timeoutID = null;

  if (overlay !== null) {
    overlay.remove();
    overlay = null;
  }
}

export function hideOverlay(agent) {
  return isReactNativeEnvironment()
    ? hideOverlayNative(agent)
    : hideOverlayWeb();
}

function showOverlayNative(
  elements,
  agent,
) {
  agent.emit("showNativeHighlight", elements);
}

function showOverlayWeb(
  elements,
  componentName,
  agent,
  hideAfterTimeout,
) {
  if (timeoutID !== null) {
    clearTimeout(timeoutID);
  }

  if (overlay === null) {
    overlay = new Overlay(agent);
  }

  overlay.inspect(elements, componentName);

  if (hideAfterTimeout) {
    timeoutID = setTimeout(() => hideOverlay(agent), SHOW_DURATION);
  }
}

export function showOverlay(
  elements,
  componentName,
  agent,
  hideAfterTimeout,
) {
  return isReactNativeEnvironment()
    ? showOverlayNative(elements, agent)
    : showOverlayWeb(
      elements,
      componentName,
      agent,
      hideAfterTimeout,
    );
}
