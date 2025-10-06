/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";

import styles from "./ContextMenuItem.css";

export default function ContextMenuItem({
  children,
  onClick,
  hide,
}) {
  const handleClick = () => {
    onClick();
    hide();
  };

  return (
    <div
      className={styles.ContextMenuItem}
      onClick={handleClick}
      onTouchEnd={handleClick}
    >
      {children}
    </div>
  );
}
