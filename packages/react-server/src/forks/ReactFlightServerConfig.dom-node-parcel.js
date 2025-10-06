/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AsyncLocalStorage } from "async_hooks";

export * from "react-server-dom-parcel/src/server/ReactFlightServerConfigParcelBundler";
export * from "react-dom-bindings/src/server/ReactFlightServerConfigDOM";

export const supportsRequestStorage = true;
export const requestStorage = new AsyncLocalStorage();

export const supportsComponentStorage = __DEV__;
export const componentStorage = supportsComponentStorage
  ? new AsyncLocalStorage()
  : (null);

export * from "../ReactFlightServerConfigDebugNode";

export * from "../ReactFlightStackConfigV8";
export * from "../ReactServerConsoleConfigServer";
