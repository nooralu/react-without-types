/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export function getHookSourceLocationKey({
  fileName,
  lineNumber,
  columnNumber,
}) {
  if (fileName == null || lineNumber == null || columnNumber == null) {
    throw Error("Hook source code location not found.");
  }
  return `${fileName}:${lineNumber}:${columnNumber}`;
}
