/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "react";
import {
  LOCAL_STORAGE_BROWSER_THEME,
  LOCAL_STORAGE_PARSE_HOOK_NAMES_KEY,
  LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY,
} from "react-devtools-shared/src/constants";
import {
  COMFORTABLE_LINE_HEIGHT,
  COMPACT_LINE_HEIGHT,
} from "react-devtools-shared/src/devtools/constants";
import { useLocalStorage } from "../hooks";
import { BridgeContext } from "../context";
import { logEvent } from "react-devtools-shared/src/Logger";

const SettingsContext = createContext(
  null,
);
SettingsContext.displayName = "SettingsContext";

function useLocalStorageWithLog(
  key,
  initialValue,
) {
  return useLocalStorage(key, initialValue, (v, k) => {
    logEvent({
      event_name: "settings-changed",
      metadata: {
        source: "localStorage setter",
        key: k,
        value: v,
      },
    });
  });
}

function SettingsContextController({
  browserTheme,
  children,
  componentsPortalContainer,
  profilerPortalContainer,
  suspensePortalContainer,
}) {
  const bridge = useContext(BridgeContext);

  const [displayDensity, setDisplayDensity] = useLocalStorageWithLog(
    "React::DevTools::displayDensity",
    "compact",
  );
  const [theme, setTheme] = useLocalStorageWithLog(
    LOCAL_STORAGE_BROWSER_THEME,
    "auto",
  );
  const [parseHookNames, setParseHookNames] = useLocalStorageWithLog(
    LOCAL_STORAGE_PARSE_HOOK_NAMES_KEY,
    false,
  );
  const [traceUpdatesEnabled, setTraceUpdatesEnabled] = useLocalStorageWithLog(
    LOCAL_STORAGE_TRACE_UPDATES_ENABLED_KEY,
    false,
  );

  const documentElements = useMemo(() => {
    const array = [
      document.documentElement,
    ];
    if (componentsPortalContainer != null) {
      array.push(
        componentsPortalContainer.ownerDocument
          .documentElement,
      );
    }
    if (profilerPortalContainer != null) {
      array.push(
        profilerPortalContainer.ownerDocument
          .documentElement,
      );
    }
    if (suspensePortalContainer != null) {
      array.push(
        suspensePortalContainer.ownerDocument
          .documentElement,
      );
    }
    return array;
  }, [
    componentsPortalContainer,
    profilerPortalContainer,
    suspensePortalContainer,
  ]);

  useLayoutEffect(() => {
    switch (displayDensity) {
      case "comfortable":
        updateDisplayDensity("comfortable", documentElements);
        break;
      case "compact":
        updateDisplayDensity("compact", documentElements);
        break;
      default:
        throw Error(`Unsupported displayDensity value "${displayDensity}"`);
    }
  }, [displayDensity, documentElements]);

  useLayoutEffect(() => {
    switch (theme) {
      case "light":
        updateThemeVariables("light", documentElements);
        break;
      case "dark":
        updateThemeVariables("dark", documentElements);
        break;
      case "auto":
        updateThemeVariables(browserTheme, documentElements);
        break;
      default:
        throw Error(`Unsupported theme value "${theme}"`);
    }
  }, [browserTheme, theme, documentElements]);

  useEffect(() => {
    bridge.send("setTraceUpdatesEnabled", traceUpdatesEnabled);
  }, [bridge, traceUpdatesEnabled]);

  const value = useMemo(
    () => ({
      displayDensity,
      lineHeight: displayDensity === "compact"
        ? COMPACT_LINE_HEIGHT
        : COMFORTABLE_LINE_HEIGHT,
      parseHookNames,
      setDisplayDensity,
      setParseHookNames,
      setTheme,
      setTraceUpdatesEnabled,
      theme,
      browserTheme,
      traceUpdatesEnabled,
    }),
    [
      displayDensity,
      parseHookNames,
      setDisplayDensity,
      setParseHookNames,
      setTheme,
      setTraceUpdatesEnabled,
      theme,
      browserTheme,
      traceUpdatesEnabled,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function updateDisplayDensity(
  displayDensity,
  documentElements,
) {
  // Sizes and paddings/margins are all rem-based,
  // so update the root font-size as well when the display preference changes.
  const computedStyle = getComputedStyle(document.body);
  const fontSize = computedStyle.getPropertyValue(
    `--${displayDensity}-root-font-size`,
  );
  const root = document.querySelector(":root");
  root.style.fontSize = fontSize;
}

export function updateThemeVariables(
  theme,
  documentElements,
) {
  // Update scrollbar color to match theme.
  // this CSS property is currently only supported in Firefox,
  // but it makes a significant UI improvement in dark mode.
  // https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color
  documentElements.forEach((documentElement) => {
    // $FlowFixMe[prop-missing] scrollbarColor is missing in CSSStyleDeclaration
    documentElement.style.scrollbarColor =
      `var(${`--${theme}-color-scroll-thumb`}) var(${`--${theme}-color-scroll-track`})`;
  });
}

export { SettingsContext, SettingsContextController };
