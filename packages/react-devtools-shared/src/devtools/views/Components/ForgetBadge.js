/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";

import Badge from "./Badge";
import IndexableDisplayName from "./IndexableDisplayName";
import Tooltip from "./reach-ui/tooltip";

import styles from "./ForgetBadge.css";

export default function ForgetBadge(props) {
  const { className = "" } = props;

  const innerView = props.indexable
    ? <IndexableDisplayName displayName="Memo" id={props.elementID} />
    : (
      "Memo"
    );

  const title =
    "✨ This component has been auto-memoized by the React Compiler.";
  return (
    <Tooltip label={title}>
      <Badge className={`${styles.Root} ${className}`}>{innerView}</Badge>
    </Tooltip>
  );
}
