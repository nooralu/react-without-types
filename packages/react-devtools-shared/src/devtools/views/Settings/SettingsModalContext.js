/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";

import { BridgeContext, StoreContext } from "../context";

const SettingsModalContext = createContext(
  null,
);
SettingsModalContext.displayName = "SettingsModalContext";

function fetchEnvironmentNames(bridge) {
  return new Promise((resolve) => {
    function onEnvironmentNames(names) {
      bridge.removeListener("environmentNames", onEnvironmentNames);
      resolve(names);
    }
    bridge.addListener("environmentNames", onEnvironmentNames);
    bridge.send("getEnvironmentNames");
  });
}

function fetchHookSettings(
  store,
) {
  return new Promise((resolve) => {
    function onHookSettings(settings) {
      store.removeListener("hookSettings", onHookSettings);
      resolve(settings);
    }

    store.addListener("hookSettings", onHookSettings);
    store.getHookSettings();
  });
}

function SettingsModalContextController({
  children,
}) {
  const bridge = useContext(BridgeContext);
  const store = useContext(StoreContext);

  const setIsModalShowing = useCallback(
    (value) => {
      startTransition(() => {
        setContext({
          isModalShowing: value,
          setIsModalShowing,
          environmentNames: value ? fetchEnvironmentNames(bridge) : null,
          hookSettings: value ? fetchHookSettings(store) : null,
        });
      });
    },
    [bridge, store],
  );

  const [currentContext, setContext] = useState({
    isModalShowing: false,
    setIsModalShowing,
    environmentNames: null,
    hookSettings: null,
  });

  return (
    <SettingsModalContext.Provider value={currentContext}>
      {children}
    </SettingsModalContext.Provider>
  );
}

export { SettingsModalContext, SettingsModalContextController };
