/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";
import { useMemo } from "react";
import { copy } from "clipboard-js";
import prettyMilliseconds from "pretty-ms";

import ContextMenuContainer from "react-devtools-shared/src/devtools/ContextMenu/ContextMenuContainer";
import { withPermissionsCheck } from "react-devtools-shared/src/frontend/utils/withPermissionsCheck";

import { getBatchRange } from "./utils/getBatchRange";
import { moveStateToRange } from "./view-base/utils/scrollState";
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from "./view-base/constants";

function zoomToBatch(
  data,
  measure,
  viewState,
  width,
) {
  const { batchUID } = measure;
  const [rangeStart, rangeEnd] = getBatchRange(batchUID, data);

  // Convert from time range to ScrollState
  const scrollState = moveStateToRange({
    state: viewState.horizontalScrollState,
    rangeStart,
    rangeEnd,
    contentLength: data.duration,

    minContentLength: data.duration * MIN_ZOOM_LEVEL,
    maxContentLength: data.duration * MAX_ZOOM_LEVEL,
    containerLength: width,
  });

  viewState.updateHorizontalScrollState(scrollState);
}

function copySummary(data, measure) {
  const { batchUID, duration, timestamp, type } = measure;

  const [startTime, stopTime] = getBatchRange(batchUID, data);

  copy(
    JSON.stringify({
      type,
      timestamp: prettyMilliseconds(timestamp),
      duration: prettyMilliseconds(duration),
      batchDuration: prettyMilliseconds(stopTime - startTime),
    }),
  );
}

export default function CanvasPageContextMenu({
  canvasRef,
  timelineData,
  hoveredEvent,
  viewState,
  canvasWidth,
  closedMenuStub,
  ref,
}) {
  const menuItems = useMemo(() => {
    if (hoveredEvent == null) {
      return [];
    }

    const {
      componentMeasure,
      flamechartStackFrame,
      measure,
      networkMeasure,
      schedulingEvent,
      suspenseEvent,
    } = hoveredEvent;
    const items = [];

    if (componentMeasure != null) {
      items.push({
        onClick: () => copy(componentMeasure.componentName),
        content: "Copy component name",
      });
    }

    if (networkMeasure != null) {
      items.push({
        onClick: () => copy(networkMeasure.url),
        content: "Copy URL",
      });
    }

    if (schedulingEvent != null) {
      items.push({
        onClick: () => copy(schedulingEvent.componentName),
        content: "Copy component name",
      });
    }

    if (suspenseEvent != null) {
      items.push({
        onClick: () => copy(suspenseEvent.componentName),
        content: "Copy component name",
      });
    }

    if (measure != null) {
      items.push(
        {
          onClick: () =>
            zoomToBatch(timelineData, measure, viewState, canvasWidth),
          content: "Zoom to batch",
        },
        {
          onClick: withPermissionsCheck(
            { permissions: ["clipboardWrite"] },
            () => copySummary(timelineData, measure),
          ),
          content: "Copy summary",
        },
      );
    }

    if (flamechartStackFrame != null) {
      items.push(
        {
          onClick: withPermissionsCheck(
            { permissions: ["clipboardWrite"] },
            () => copy(flamechartStackFrame.scriptUrl),
          ),
          content: "Copy file path",
        },
        {
          onClick: withPermissionsCheck(
            { permissions: ["clipboardWrite"] },
            () =>
              copy(
                `line ${flamechartStackFrame.locationLine ?? ""}, column ${
                  flamechartStackFrame.locationColumn ?? ""
                }`,
              ),
          ),
          content: "Copy location",
        },
      );
    }

    return items;
  }, [hoveredEvent, viewState, canvasWidth]);

  return (
    <ContextMenuContainer
      anchorElementRef={canvasRef}
      items={menuItems}
      closedMenuStub={closedMenuStub}
      ref={ref}
    />
  );
}
