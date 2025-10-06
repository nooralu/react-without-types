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
  unstable_useCacheRefresh as useCacheRefresh,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TreeStateContext } from "./TreeContext";
import { BridgeContext, StoreContext } from "../context";
import {
  inspectElement,
  startElementUpdatesPolling,
} from "react-devtools-shared/src/inspectedElementCache";
import {
  clearHookNamesCache,
  hasAlreadyLoadedHookNames,
  loadHookNames,
} from "react-devtools-shared/src/hookNamesCache";
import { loadModule } from "react-devtools-shared/src/dynamicImportCache";
import FetchFileWithCachingContext from "react-devtools-shared/src/devtools/views/Components/FetchFileWithCachingContext";
import HookNamesModuleLoaderContext from "react-devtools-shared/src/devtools/views/Components/HookNamesModuleLoaderContext";
import { SettingsContext } from "../Settings/SettingsContext";

export const InspectedElementContext = createContext(null);

export function InspectedElementContextController({
  children,
}) {
  const { inspectedElementID } = useContext(TreeStateContext);
  const fetchFileWithCaching = useContext(FetchFileWithCachingContext);
  const bridge = useContext(BridgeContext);
  const store = useContext(StoreContext);
  const { parseHookNames: parseHookNamesByDefault } = useContext(
    SettingsContext,
  );

  // parseHookNames has a lot of code.
  // Embedding it into a build makes the build large.
  // This function enables DevTools to make use of Suspense to lazily import() it only if the feature will be used.
  // TODO (Webpack 5) Hopefully we can remove this indirection once the Webpack 5 upgrade is completed.
  const hookNamesModuleLoader = useContext(HookNamesModuleLoaderContext);

  const refresh = useCacheRefresh();

  // Temporarily stores most recently-inspected (hydrated) path.
  // The transition that updates this causes the component to re-render and ask the cache->backend for the new path.
  // When a path is sent along with an "inspectElement" request,
  // the backend knows to send its dehydrated data even if the element hasn't updated since the last request.
  const [state, setState] = useState({
    element: null,
    path: null,
  });

  const element = inspectedElementID !== null
    ? store.getElementByID(inspectedElementID)
    : null;

  const alreadyLoadedHookNames = element != null &&
    hasAlreadyLoadedHookNames(element);

  // Parse the currently inspected element's hook names.
  // This may be enabled by default (for all elements)
  // or it may be opted into on a per-element basis (if it's too slow to be on by default).
  const [parseHookNames, setParseHookNames] = useState(
    parseHookNamesByDefault || alreadyLoadedHookNames,
  );

  const [bridgeIsAlive, setBridgeIsAliveStatus] = useState(true);

  const elementHasChanged = element !== null && element !== state.element;

  // Reset the cached inspected paths when a new element is selected.
  if (elementHasChanged) {
    setState({
      element,
      path: null,
    });

    setParseHookNames(parseHookNamesByDefault || alreadyLoadedHookNames);
  }

  const purgeCachedMetadataRef = useRef(null);

  // Don't load a stale element from the backend; it wastes bridge bandwidth.
  let hookNames = null;
  let inspectedElement = null;
  if (!elementHasChanged && element !== null) {
    inspectedElement = inspectElement(element, state.path, store, bridge);

    if (typeof hookNamesModuleLoader === "function") {
      if (parseHookNames || alreadyLoadedHookNames) {
        const hookNamesModule = loadModule(hookNamesModuleLoader);
        if (hookNamesModule !== null) {
          const { parseHookNames: loadHookNamesFunction, purgeCachedMetadata } =
            hookNamesModule;

          purgeCachedMetadataRef.current = purgeCachedMetadata;

          if (
            inspectedElement !== null &&
            inspectedElement.hooks !== null &&
            loadHookNamesFunction !== null
          ) {
            hookNames = loadHookNames(
              element,
              inspectedElement.hooks,
              loadHookNamesFunction,
              fetchFileWithCaching,
            );
          }
        }
      }
    }
  }

  const toggleParseHookNames = useCallback(() => {
    startTransition(() => {
      setParseHookNames((value) => !value);
      refresh();
    });
  }, [setParseHookNames]);

  const inspectPaths = useCallback(
    (path) => {
      startTransition(() => {
        setState({
          element: state.element,
          path,
        });
        refresh();
      });
    },
    [setState, state],
  );

  useEffect(() => {
    const purgeCachedMetadata = purgeCachedMetadataRef.current;
    if (typeof purgeCachedMetadata === "function") {
      // When Fast Refresh updates a component, any cached AST metadata may be invalid.
      const fastRefreshScheduled = () => {
        startTransition(() => {
          clearHookNamesCache();
          purgeCachedMetadata();
          refresh();
        });
      };
      bridge.addListener("fastRefreshScheduled", fastRefreshScheduled);
      return () =>
        bridge.removeListener("fastRefreshScheduled", fastRefreshScheduled);
    }
  }, [bridge]);

  // Reset path now that we've asked the backend to hydrate it.
  // The backend is stateful, so we don't need to remember this path the next time we inspect.
  useEffect(() => {
    if (state.path !== null) {
      setState({
        element: state.element,
        path: null,
      });
    }
  }, [state]);

  useEffect(() => {
    // Assuming that new bridge is always alive at this moment
    setBridgeIsAliveStatus(true);

    const listener = () => setBridgeIsAliveStatus(false);
    bridge.addListener("shutdown", listener);

    return () => bridge.removeListener("shutdown", listener);
  }, [bridge]);

  // Periodically poll the selected element for updates.
  useEffect(() => {
    if (element !== null && bridgeIsAlive) {
      const { abort, pause, resume } = startElementUpdatesPolling({
        bridge,
        element,
        refresh,
        store,
      });

      bridge.addListener("resumeElementPolling", resume);
      bridge.addListener("pauseElementPolling", pause);

      return () => {
        bridge.removeListener("resumeElementPolling", resume);
        bridge.removeListener("pauseElementPolling", pause);

        abort();
      };
    }
  }, [
    element,
    hookNames,
    // Reset this timer any time the element we're inspecting gets a new response.
    // No sense to ping right away after e.g. inspecting/hydrating a path.
    inspectedElement,
    state,
    bridgeIsAlive,
  ]);

  const value = useMemo(
    () => ({
      hookNames,
      inspectedElement,
      inspectPaths,
      parseHookNames,
      toggleParseHookNames,
    }),
    [
      hookNames,
      inspectedElement,
      inspectPaths,
      parseHookNames,
      toggleParseHookNames,
    ],
  );

  return (
    <InspectedElementContext.Provider value={value}>
      {children}
    </InspectedElementContext.Provider>
  );
}
