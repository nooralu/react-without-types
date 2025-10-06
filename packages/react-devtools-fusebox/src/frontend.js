/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";
import { createRoot } from "react-dom/client";
import Bridge from "react-devtools-shared/src/bridge";
import Store from "react-devtools-shared/src/devtools/store";
import DevTools from "react-devtools-shared/src/devtools/views/DevTools";

export function createBridge(wall) {
  if (wall != null) {
    return new Bridge(wall);
  }

  return new Bridge({ listen: () => {}, send: () => {} });
}

export function createStore(bridge, config) {
  return new Store(bridge, {
    checkBridgeProtocolCompatibility: true,
    supportsTraceUpdates: true,
    supportsClickToInspect: true,
    ...config,
  });
}

function initializeTab(
  tab,
  contentWindow,
  options,
) {
  const {
    bridge,
    store,
    theme = "light",
    viewAttributeSourceFunction,
    viewElementSourceFunction,
    canViewElementSourceFunction,
    fetchFileWithCaching,
  } = options;
  const root = createRoot(contentWindow);

  root.render(
    <DevTools
      bridge={bridge}
      browserTheme={theme}
      store={store}
      showTabBar={false}
      overrideTab={tab}
      warnIfLegacyBackendDetected={true}
      enabledInspectedElementContextMenu={true}
      viewAttributeSourceFunction={viewAttributeSourceFunction}
      viewElementSourceFunction={viewElementSourceFunction}
      canViewElementSourceFunction={canViewElementSourceFunction}
      fetchFileWithCaching={fetchFileWithCaching}
    />,
  );
}

export function initializeComponents(
  contentWindow,
  options,
) {
  initializeTab("components", contentWindow, options);
}

export function initializeProfiler(
  contentWindow,
  options,
) {
  initializeTab("profiler", contentWindow, options);
}
