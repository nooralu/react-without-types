/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { REACT_FRAGMENT_TYPE } from "shared/ReactSymbols";
import {
  jsxDEV as _jsxDEV,
  jsxProd,
  jsxProdSignatureRunningInDevWithDynamicChildren,
  jsxProdSignatureRunningInDevWithStaticChildren,
} from "./ReactJSXElement";

const jsx = __DEV__ ? jsxProdSignatureRunningInDevWithDynamicChildren : jsxProd;
// we may want to special case jsxs internally to take advantage of static children.
// for now we can ship identical prod functions
const jsxs = __DEV__ ? jsxProdSignatureRunningInDevWithStaticChildren : jsxProd;

const jsxDEV = __DEV__ ? _jsxDEV : undefined;

export { jsx, jsxDEV, jsxs, REACT_FRAGMENT_TYPE as Fragment };
