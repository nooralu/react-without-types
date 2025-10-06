/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  getCommittingRoot,
  getPendingTransitionTypes,
} from "./ReactFiberWorkLoop";

let globalClientIdCounter = 0;

export function getViewTransitionName(
  props,
  instance,
) {
  if (props.name != null && props.name !== "auto") {
    return props.name;
  }
  if (instance.autoName !== null) {
    return instance.autoName;
  }

  // We assume we always call this in the commit phase.
  const root = getCommittingRoot();
  const identifierPrefix = root.identifierPrefix;
  const globalClientId = globalClientIdCounter++;
  const name = "_" + identifierPrefix + "t_" + globalClientId.toString(32) +
    "_";
  instance.autoName = name;
  return name;
}

function getClassNameByType(classByType) {
  if (classByType == null || typeof classByType === "string") {
    return classByType;
  }
  let className = null;
  const activeTypes = getPendingTransitionTypes();
  if (activeTypes !== null) {
    for (let i = 0; i < activeTypes.length; i++) {
      const match = classByType[activeTypes[i]];
      if (match != null) {
        if (match === "none") {
          // If anything matches "none" that takes precedence over any other
          // type that also matches.
          return "none";
        }
        if (className == null) {
          className = match;
        } else {
          className += " " + match;
        }
      }
    }
  }
  if (className == null) {
    // We had no other matches. Match the default for this configuration.
    return classByType.default;
  }
  return className;
}

export function getViewTransitionClassName(
  defaultClass,
  eventClass,
) {
  const className = getClassNameByType(defaultClass);
  const eventClassName = getClassNameByType(eventClass);
  if (eventClassName == null) {
    return className === "auto" ? null : className;
  }
  if (eventClassName === "auto") {
    return null;
  }
  return eventClassName;
}
