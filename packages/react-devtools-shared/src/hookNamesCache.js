/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { __DEBUG__ } from "react-devtools-shared/src/constants";

import * as React from "react";

import { withCallbackPerfMeasurements } from "./PerformanceLoggingUtils";
import { logEvent } from "./Logger";

const TIMEOUT = 30000;
function readRecord(record) {
  if (typeof React.use === "function") {
    try {
      // eslint-disable-next-line react-hooks-published/rules-of-hooks
      return React.use(record);
    } catch (x) {
      if (record.status === "rejected") {
        return null;
      }
      throw x;
    }
  }
  if (record.status === "fulfilled") {
    return record.value;
  } else if (record.status === "rejected") {
    return null;
  } else {
    throw record;
  }
}

// This is intentionally a module-level Map, rather than a React-managed one.
// Otherwise, refreshing the inspected element cache would also clear this cache.
// TODO Rethink this if the React API constraints change.
// See https://github.com/reactwg/react-18/discussions/25#discussioncomment-980435
let map = new WeakMap();

export function hasAlreadyLoadedHookNames(element) {
  const record = map.get(element);
  return record != null && record.status === "fulfilled";
}

export function getAlreadyLoadedHookNames(element) {
  const record = map.get(element);
  if (record != null && record.status === "fulfilled") {
    return record.value;
  }
  return null;
}

export function loadHookNames(
  element,
  hooksTree,
  loadHookNamesFunction,
  fetchFileWithCaching,
) {
  let record = map.get(element);

  if (__DEBUG__) {
    console.groupCollapsed("loadHookNames() record:");
    console.log(record);
    console.groupEnd();
  }

  if (!record) {
    const callbacks = new Set();
    const rejectCallbacks = new Set();
    const thenable = {
      status: "pending",
      value: null,
      reason: null,
      then(callback, reject) {
        callbacks.add(callback);
        rejectCallbacks.add(reject);
      },

      // Optional property used by Timeline:
      displayName: `Loading hook names for ${element.displayName || "Unknown"}`,
    };

    let timeoutID;
    let didTimeout = false;
    let status = "unknown";
    let resolvedHookNames = null;

    const wake = () => {
      if (timeoutID) {
        clearTimeout(timeoutID);
        timeoutID = null;
      }

      // This assumes they won't throw.
      callbacks.forEach((callback) => callback(thenable.value));
      callbacks.clear();
      rejectCallbacks.clear();
    };
    const wakeRejections = () => {
      if (timeoutID) {
        clearTimeout(timeoutID);
        timeoutID = null;
      }
      // This assumes they won't throw.
      rejectCallbacks.forEach((callback) => callback(thenable.reason));
      rejectCallbacks.clear();
      callbacks.clear();
    };

    const handleLoadComplete = (durationMs) => {
      // Log duration for parsing hook names
      logEvent({
        event_name: "load-hook-names",
        event_status: status,
        duration_ms: durationMs,
        inspected_element_display_name: element.displayName,
        inspected_element_number_of_hooks: resolvedHookNames?.size ?? null,
      });
    };

    record = thenable;

    withCallbackPerfMeasurements(
      "loadHookNames",
      (done) => {
        loadHookNamesFunction(hooksTree, fetchFileWithCaching).then(
          function onSuccess(hookNames) {
            if (didTimeout) {
              return;
            }

            if (__DEBUG__) {
              console.log("[hookNamesCache] onSuccess() hookNames:", hookNames);
            }

            if (hookNames) {
              const fulfilledThenable = thenable;
              fulfilledThenable.status = "fulfilled";
              fulfilledThenable.value = hookNames;
              status = "success";
              resolvedHookNames = hookNames;
              done();
              wake();
            } else {
              const notFoundThenable = thenable;
              notFoundThenable.status = "rejected";
              notFoundThenable.reason = null;
              status = "error";
              resolvedHookNames = hookNames;
              done();
              wakeRejections();
            }
          },
          function onError(error) {
            if (didTimeout) {
              return;
            }

            if (__DEBUG__) {
              console.log("[hookNamesCache] onError()");
            }

            console.error(error);

            const rejectedThenable = thenable;
            rejectedThenable.status = "rejected";
            rejectedThenable.reason = null;

            status = "error";
            done();
            wakeRejections();
          },
        );

        // Eventually timeout and stop trying to load names.
        timeoutID = setTimeout(function onTimeout() {
          if (__DEBUG__) {
            console.log("[hookNamesCache] onTimeout()");
          }

          timeoutID = null;

          didTimeout = true;

          const timedoutThenable = thenable;
          timedoutThenable.status = "rejected";
          timedoutThenable.reason = null;

          status = "timeout";
          done();
          wakeRejections();
        }, TIMEOUT);
      },
      handleLoadComplete,
    );
    map.set(element, record);
  }

  const response = readRecord(record);
  return response;
}

export function clearHookNamesCache() {
  map = new WeakMap();
}
