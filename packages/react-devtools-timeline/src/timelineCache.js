/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";

import { importFile as importFileWorker } from "./import-worker";

// This is intentionally a module-level Map, rather than a React-managed one.
// Otherwise, refreshing the inspected element cache would also clear this cache.
// Profiler file contents are static anyway.
const fileNameToProfilerDataMap = new Map();

function readRecord(record) {
  if (typeof React.use === "function") {
    try {
      // eslint-disable-next-line react-hooks-published/rules-of-hooks
      return React.use(record);
    } catch (x) {
      if (record.status === "rejected") {
        return (record.reason);
      }
      throw x;
    }
  }
  if (record.status === "fulfilled") {
    return record.value;
  } else if (record.status === "rejected") {
    return (record.reason);
  } else {
    throw record;
  }
}

export function importFile(file) {
  const fileName = file.name;
  let record = fileNameToProfilerDataMap.get(fileName);

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
      displayName: `Importing file "${fileName}"`,
    };

    const wake = () => {
      // This assumes they won't throw.
      callbacks.forEach((callback) => callback(thenable.value));
      callbacks.clear();
      rejectCallbacks.clear();
    };
    const wakeRejections = () => {
      // This assumes they won't throw.
      rejectCallbacks.forEach((callback) => callback(thenable.reason));
      rejectCallbacks.clear();
      callbacks.clear();
    };

    record = thenable;

    importFileWorker(file).then((data) => {
      switch (data.status) {
        case "SUCCESS":
          const fulfilledThenable = thenable;
          fulfilledThenable.status = "fulfilled";
          fulfilledThenable.value = data.processedData;
          wake();
          break;
        case "INVALID_PROFILE_ERROR":
        case "UNEXPECTED_ERROR":
          const rejectedThenable = thenable;
          rejectedThenable.status = "rejected";
          rejectedThenable.reason = data.error;
          wakeRejections();
          break;
      }
    });

    fileNameToProfilerDataMap.set(fileName, record);
  }

  const response = readRecord(record);
  return response;
}
