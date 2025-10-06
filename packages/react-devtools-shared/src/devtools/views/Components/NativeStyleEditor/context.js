/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import {
  BridgeContext,
  StoreContext,
} from "react-devtools-shared/src/devtools/views/context";
import { TreeStateContext } from "react-devtools-shared/src/devtools/views/Components/TreeContext";

const NativeStyleContext = createContext(
  null,
);
NativeStyleContext.displayName = "NativeStyleContext";

function NativeStyleContextController({ children }) {
  const bridge = useContext(BridgeContext);
  const store = useContext(StoreContext);
  const { inspectedElementID } = useContext(TreeStateContext);

  const [currentStyleAndLayout, setCurrentStyleAndLayout] = useState(null);

  // This effect handler polls for updates on the currently selected element.
  useEffect(() => {
    if (inspectedElementID === null) {
      setCurrentStyleAndLayout(null);
      return () => {};
    }

    let requestTimeoutId = null;
    const sendRequest = () => {
      requestTimeoutId = null;
      const rendererID = store.getRendererIDForElement(inspectedElementID);

      if (rendererID !== null) {
        bridge.send("NativeStyleEditor_measure", {
          id: inspectedElementID,
          rendererID,
        });
      }
    };

    // Send the initial measurement request.
    // We'll poll for an update in the response handler below.
    sendRequest();

    const onStyleAndLayout = ({ id, layout, style }) => {
      // If this is the element we requested, wait a little bit and then ask for another update.
      if (id === inspectedElementID) {
        if (requestTimeoutId !== null) {
          clearTimeout(requestTimeoutId);
        }
        requestTimeoutId = setTimeout(sendRequest, 1000);
      }

      const styleAndLayout = {
        layout,
        style,
      };
      setCurrentStyleAndLayout(styleAndLayout);
    };

    bridge.addListener("NativeStyleEditor_styleAndLayout", onStyleAndLayout);
    return () => {
      bridge.removeListener(
        "NativeStyleEditor_styleAndLayout",
        onStyleAndLayout,
      );

      if (requestTimeoutId !== null) {
        clearTimeout(requestTimeoutId);
      }
    };
  }, [bridge, inspectedElementID, store]);

  return (
    <NativeStyleContext.Provider value={currentStyleAndLayout}>
      {children}
    </NativeStyleContext.Provider>
  );
}

export { NativeStyleContext, NativeStyleContextController };
