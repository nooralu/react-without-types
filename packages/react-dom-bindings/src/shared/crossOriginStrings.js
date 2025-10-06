/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export function getCrossOriginString(input) {
  if (typeof input === "string") {
    return input === "use-credentials" ? input : "";
  }
  return undefined;
}

export function getCrossOriginStringAs(
  as,
  input,
) {
  if (as === "font") {
    return "";
  }
  if (typeof input === "string") {
    return input === "use-credentials" ? input : "";
  }
  return undefined;
}
