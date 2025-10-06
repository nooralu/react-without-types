/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";

import {
  startTransition,
  unstable_getCacheForType as getCacheForType,
} from "react";
import Store from "react-devtools-shared/src/devtools/store";
import { inspectElement as inspectElementMutableSource } from "react-devtools-shared/src/inspectedElementMutableSource";
import ElementPollingCancellationError from "react-devtools-shared/src//errors/ElementPollingCancellationError";

function readRecord(record) {
  if (typeof React.use === "function") {
    // eslint-disable-next-line react-hooks-published/rules-of-hooks
    return React.use(record);
  }
  if (record.status === "fulfilled") {
    return record.value;
  } else if (record.status === "rejected") {
    throw record.reason;
  } else {
    throw record;
  }
}

function createMap() {
  return new WeakMap();
}

function getRecordMap() {
  return getCacheForType(createMap);
}

function createCacheSeed(
  element,
  inspectedElement,
) {
  const thenable = {
    then(callback, reject) {
      callback(thenable.value);
    },
    status: "fulfilled",
    value: inspectedElement,
  };
  const map = createMap();
  map.set(element, thenable);
  return [createMap, map];
}

/**
 * Fetches element props and state from the backend for inspection.
 * This method should be called during render; it will suspend if data has not yet been fetched.
 */
export function inspectElement(
  element,
  path,
  store,
  bridge,
) {
  const map = getRecordMap();
  let record = map.get(element);
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
      displayName: `Inspecting ${element.displayName || "Unknown"}`,
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

    const rendererID = store.getRendererIDForElement(element.id);
    if (rendererID == null) {
      const rejectedThenable = thenable;
      rejectedThenable.status = "rejected";
      rejectedThenable.reason = new Error(
        `Could not inspect element with id "${element.id}". No renderer found.`,
      );

      map.set(element, record);

      return null;
    }

    inspectElementMutableSource(bridge, element, path, rendererID).then(
      ([inspectedElement]) => {
        const fulfilledThenable = thenable;
        fulfilledThenable.status = "fulfilled";
        fulfilledThenable.value = inspectedElement;
        wake();
      },
      (error) => {
        console.error(error);

        const rejectedThenable = thenable;
        rejectedThenable.status = "rejected";
        rejectedThenable.reason = error;

        wakeRejections();
      },
    );

    map.set(element, record);
  }

  const response = readRecord(record);
  return response;
}

/**
 * Asks the backend for updated props and state from an expected element.
 * This method should never be called during render; call it from an effect or event handler.
 * This method will schedule an update if updated information is returned.
 */
export function checkForUpdate({
  bridge,
  element,
  refresh,
  store,
}) {
  const { id } = element;
  const rendererID = store.getRendererIDForElement(id);

  if (rendererID == null) {
    return;
  }

  return inspectElementMutableSource(
    bridge,
    element,
    null,
    rendererID,
    true,
  ).then(
    ([inspectedElement, responseType]) => {
      if (responseType === "full-data") {
        startTransition(() => {
          const [key, value] = createCacheSeed(element, inspectedElement);
          refresh(key, value);
        });
      }
    },
  );
}

function createPromiseWhichResolvesInOneSecond() {
  return new Promise((resolve) => setTimeout(resolve, 1000));
}

export function startElementUpdatesPolling({
  bridge,
  element,
  refresh,
  store,
}) {
  let status = "idle";

  function abort() {
    status = "aborted";
  }

  function resume() {
    if (status === "running" || status === "aborted") {
      return;
    }

    status = "idle";
    poll();
  }

  function pause() {
    if (status === "paused" || status === "aborted") {
      return;
    }

    status = "paused";
  }

  function poll() {
    status = "running";

    return Promise.allSettled([
      checkForUpdate({ bridge, element, refresh, store }),
      createPromiseWhichResolvesInOneSecond(),
    ])
      .then(([{ status: updateStatus, reason }]) => {
        // There isn't much to do about errors in this case,
        // but we should at least log them, so they aren't silent.
        // Log only if polling is still active, we can't handle the case when
        // request was sent, and then bridge was remounted (for example, when user did navigate to a new page),
        // but at least we can mark that polling was aborted
        if (updateStatus === "rejected" && status !== "aborted") {
          // This is expected Promise rejection, no need to log it
          if (reason instanceof ElementPollingCancellationError) {
            return;
          }

          console.error(reason);
        }
      })
      .finally(() => {
        const shouldContinuePolling = status !== "aborted" &&
          status !== "paused";

        status = "idle";

        if (shouldContinuePolling) {
          return poll();
        }
      });
  }

  poll();

  return { abort, resume, pause };
}

export function clearCacheBecauseOfError(refresh) {
  startTransition(() => {
    const map = createMap();
    refresh(createMap, map);
  });
}
