/**
 * Copyright (c) Meta Platforms, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { REACT_POSTPONE_TYPE } from "shared/ReactSymbols";

export function postpone(reason) {
  // eslint-disable-next-line react-internal/prod-error-codes
  const postponeInstance = new Error(reason);
  postponeInstance.$$typeof = REACT_POSTPONE_TYPE;
  throw postponeInstance;
}
