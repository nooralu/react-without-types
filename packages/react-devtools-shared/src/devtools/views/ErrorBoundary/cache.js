/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";

import { unstable_getCacheForType as getCacheForType } from "react";
import { searchGitHubIssues } from "./githubAPI";

const API_TIMEOUT = 3000;
function readRecord(record) {
  if (typeof React.use === "function") {
    try {
      // eslint-disable-next-line react-hooks-published/rules-of-hooks
      return React.use(record);
    } catch (x) {
      if (x === null) {
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

function createMap() {
  return new Map();
}

function getRecordMap() {
  return getCacheForType(createMap);
}

export function findGitHubIssue(errorMessage) {
  errorMessage = normalizeErrorMessage(errorMessage);

  const map = getRecordMap();
  let record = map.get(errorMessage);

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
      displayName: `Searching GitHub issues for error "${errorMessage}"`,
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

    let didTimeout = false;

    searchGitHubIssues(errorMessage)
      .then((maybeItem) => {
        if (didTimeout) {
          return;
        }

        if (maybeItem) {
          const fulfilledThenable = thenable;
          fulfilledThenable.status = "fulfilled";
          fulfilledThenable.value = maybeItem;
          wake();
        } else {
          const notFoundThenable = thenable;
          notFoundThenable.status = "rejected";
          notFoundThenable.reason = null;
          wakeRejections();
        }
      })
      .catch((error) => {
        const rejectedThenable = thenable;
        rejectedThenable.status = "rejected";
        rejectedThenable.reason = null;
        wakeRejections();
      });

    // Only wait a little while for GitHub results before showing a fallback.
    setTimeout(() => {
      didTimeout = true;

      const timedoutThenable = thenable;
      timedoutThenable.status = "rejected";
      timedoutThenable.reason = null;
      wakeRejections();
    }, API_TIMEOUT);

    map.set(errorMessage, record);
  }

  const response = readRecord(record);
  return response;
}

function normalizeErrorMessage(errorMessage) {
  // Remove Fiber IDs from error message (as those will be unique).
  errorMessage = errorMessage.replace(/"[0-9]+"/, "");
  return errorMessage;
}
