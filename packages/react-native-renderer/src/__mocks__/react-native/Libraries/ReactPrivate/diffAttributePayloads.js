/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */

import deepDiffer from "./deepDiffer";

export default function diff(
  prevProps,
  nextProps,
  validAttributes,
) {
  const { children: _prevChildren, ...prevPropsPassed } = prevProps;
  const { children: _nextChildren, ...nextPropsToPass } = nextProps;
  return deepDiffer(prevPropsPassed, nextPropsToPass) ? nextPropsToPass : null;
}
