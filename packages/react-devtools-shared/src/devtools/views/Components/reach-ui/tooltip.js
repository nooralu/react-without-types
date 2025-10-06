/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";
import ReachTooltip from "@reach/tooltip";
import tooltipStyles from "./Tooltip.css";
import useThemeStyles from "../../useThemeStyles";

const Tooltip = ({
  children,
  className = "",
  ...props
}) => {
  const style = useThemeStyles();
  return (
    // $FlowFixMe[cannot-spread-inexact] unsafe spread
    <ReachTooltip
      className={`${tooltipStyles.Tooltip} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </ReachTooltip>
  );
};

export default Tooltip;
