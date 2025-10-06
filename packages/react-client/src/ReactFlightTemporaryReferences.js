/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export function createTemporaryReferenceSet() {
  return new Map();
}

export function writeTemporaryReference(
  set,
  reference,
  object,
) {
  set.set(reference, object);
}

export function readTemporaryReference(
  set,
  reference,
) {
  return (set.get(reference));
}
