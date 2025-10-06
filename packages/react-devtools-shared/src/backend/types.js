/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * WARNING:
 * This file contains types that are conceptually related to React internals and
 * DevTools backends, but can be passed to frontend via the bridge.
 * Be mindful of backwards compatibility when making changes.
 */

// DEV

// Profiling data collected by the renderer interface.
// This information will be passed to the frontend and combined with info it collects.

// Serialized version of ReactIOInfo

// Serialized version of ReactAsyncInfo

export const InspectElementErrorType = "error";
export const InspectElementFullDataType = "full-data";
export const InspectElementNoChangeType = "no-change";
export const InspectElementNotFoundType = "not-found";

// Renderers use these APIs to report profiling data to DevTools at runtime.
// They get passed from the DevTools backend to the reconciler during injection.
