/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { __DEBUG__ } from "react-devtools-shared/src/constants";

import * as React from "react";

const TIMEOUT = 30000;

// This is intentionally a module-level Map, rather than a React-managed one.
// Otherwise, refreshing the inspected element cache would also clear this cache.
// Modules are static anyway.
const moduleLoaderFunctionToModuleMap = new Map();
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

// TODO Flow type
export function loadModule(moduleLoaderFunction) {
  let record = moduleLoaderFunctionToModuleMap.get(moduleLoaderFunction);

  if (__DEBUG__) {
    console.log(
      `[dynamicImportCache] loadModule("${moduleLoaderFunction.name}")`,
    );
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
      displayName: `Loading module "${moduleLoaderFunction.name}"`,
    };

    const wake = () => {
      if (timeoutID) {
        clearTimeout(timeoutID);
        timeoutID = null;
      }

      // This assumes they won't throw.
      callbacks.forEach((callback) => callback());
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

    record = thenable;

    let didTimeout = false;

    moduleLoaderFunction().then(
      (module) => {
        if (__DEBUG__) {
          console.log(
            `[dynamicImportCache] loadModule("${moduleLoaderFunction.name}") then()`,
          );
        }

        if (didTimeout) {
          return;
        }

        const fulfilledThenable = thenable;
        fulfilledThenable.status = "fulfilled";
        fulfilledThenable.value = module;

        wake();
      },
      (error) => {
        if (__DEBUG__) {
          console.log(
            `[dynamicImportCache] loadModule("${moduleLoaderFunction.name}") catch()`,
          );
        }

        if (didTimeout) {
          return;
        }

        console.log(error);

        const rejectedThenable = thenable;
        rejectedThenable.status = "rejected";
        rejectedThenable.reason = error;

        wakeRejections();
      },
    );

    // Eventually timeout and stop trying to load the module.
    let timeoutID = setTimeout(function onTimeout() {
      if (__DEBUG__) {
        console.log(
          `[dynamicImportCache] loadModule("${moduleLoaderFunction.name}") onTimeout()`,
        );
      }

      timeoutID = null;

      didTimeout = true;

      const rejectedThenable = thenable;
      rejectedThenable.status = "rejected";
      rejectedThenable.reason = null;

      wakeRejections();
    }, TIMEOUT);

    moduleLoaderFunctionToModuleMap.set(moduleLoaderFunction, record);
  }

  // $FlowFixMe[underconstrained-implicit-instantiation]
  const response = readRecord(record);
  return response;
}
