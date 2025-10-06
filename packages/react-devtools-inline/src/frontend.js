/**  */

import * as React from "react";
import { forwardRef } from "react";
import Bridge from "react-devtools-shared/src/bridge";
import Store from "react-devtools-shared/src/devtools/store";
import DevTools from "react-devtools-shared/src/devtools/views/DevTools";
import { getSavedComponentFilters } from "react-devtools-shared/src/utils";

export function createStore(bridge, config) {
  return new Store(bridge, {
    checkBridgeProtocolCompatibility: true,
    supportsTraceUpdates: true,
    supportsTimeline: true,
    ...config,
  });
}

export function createBridge(contentWindow, wall) {
  if (wall == null) {
    wall = {
      listen(fn) {
        // $FlowFixMe[missing-local-annot]
        const onMessage = ({ data }) => {
          fn(data);
        };
        window.addEventListener("message", onMessage);
        return () => {
          window.removeEventListener("message", onMessage);
        };
      },
      send(event, payload, transferable) {
        contentWindow.postMessage({ event, payload }, "*", transferable);
      },
    };
  }

  return (new Bridge(wall));
}

export function initialize(
  contentWindow,
  {
    bridge,
    store,
  } = {},
) {
  if (bridge == null) {
    bridge = createBridge(contentWindow);
  }

  // Type refinement.
  const frontendBridge = bridge;

  if (store == null) {
    store = createStore(frontendBridge);
  }

  const onGetSavedPreferences = () => {
    // This is the only message we're listening for,
    // so it's safe to cleanup after we've received it.
    frontendBridge.removeListener("getSavedPreferences", onGetSavedPreferences);

    const data = {
      componentFilters: getSavedComponentFilters(),
    };

    // The renderer interface can't read saved preferences directly,
    // because they are stored in localStorage within the context of the extension.
    // Instead it relies on the extension to pass them through.
    frontendBridge.send("savedPreferences", data);
  };

  frontendBridge.addListener("getSavedPreferences", onGetSavedPreferences);

  const ForwardRef = forwardRef((props, ref) => (
    <DevTools ref={ref} bridge={frontendBridge} store={store} {...props} />
  ));
  ForwardRef.displayName = "DevTools";

  return ForwardRef;
}
