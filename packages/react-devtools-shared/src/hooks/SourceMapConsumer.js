/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { withSyncPerfMeasurements } from "react-devtools-shared/src/PerformanceLoggingUtils";
import { decode } from "@jridgewell/sourcemap-codec";

export default function SourceMapConsumer(
  sourceMapJSON,
) {
  if (sourceMapJSON.sections != null) {
    return IndexedSourceMapConsumer(sourceMapJSON);
  } else {
    return BasicSourceMapConsumer(sourceMapJSON);
  }
}

function BasicSourceMapConsumer(sourceMapJSON) {
  const decodedMappings = withSyncPerfMeasurements(
    "Decoding source map mappings with @jridgewell/sourcemap-codec",
    () => decode(sourceMapJSON.mappings),
  );

  function originalPositionFor({
    columnNumber,
    lineNumber,
  }) {
    // Error.prototype.stack columns are 1-based (like most IDEs) but ASTs are 0-based.
    const targetColumnNumber = columnNumber - 1;

    const lineMappings = decodedMappings[lineNumber - 1];

    let nearestEntry = null;

    let startIndex = 0;
    let stopIndex = lineMappings.length - 1;
    let index = -1;
    while (startIndex <= stopIndex) {
      index = Math.floor((stopIndex + startIndex) / 2);
      nearestEntry = lineMappings[index];

      const currentColumn = nearestEntry[0];
      if (currentColumn === targetColumnNumber) {
        break;
      } else {
        if (currentColumn > targetColumnNumber) {
          if (stopIndex - index > 0) {
            stopIndex = index;
          } else {
            index = stopIndex;
            break;
          }
        } else {
          if (index - startIndex > 0) {
            startIndex = index;
          } else {
            index = startIndex;
            break;
          }
        }
      }
    }

    // We have found either the exact element, or the next-closest element.
    // However there may be more than one such element.
    // Make sure we always return the smallest of these.
    while (index > 0) {
      const previousEntry = lineMappings[index - 1];
      const currentColumn = previousEntry[0];
      if (currentColumn !== targetColumnNumber) {
        break;
      }
      index--;
    }

    if (nearestEntry == null) {
      // TODO maybe fall back to the runtime source instead of throwing?
      throw Error(
        `Could not find runtime location for line:${lineNumber} and column:${columnNumber}`,
      );
    }

    const sourceIndex = nearestEntry[1];
    const sourceContent = sourceMapJSON.sourcesContent != null
      ? sourceMapJSON.sourcesContent[sourceIndex]
      : null;
    const sourceURL = sourceMapJSON.sources[sourceIndex] ?? null;
    const line = nearestEntry[2] + 1;
    const column = nearestEntry[3];
    const ignored = sourceMapJSON.ignoreList != null &&
      sourceMapJSON.ignoreList.includes(sourceIndex);
    return {
      column,
      line,
      sourceContent: sourceContent,
      sourceURL: sourceURL,
      ignored,
    };
  }

  return ({
    originalPositionFor,
  });
}

function IndexedSourceMapConsumer(sourceMapJSON) {
  let lastOffset = {
    line: -1,
    column: 0,
  };

  const sections = sourceMapJSON.sections.map((section) => {
    const offset = section.offset;
    const offsetLine0 = offset.line;
    const offsetColumn0 = offset.column;

    if (
      offsetLine0 < lastOffset.line ||
      (offsetLine0 === lastOffset.line && offsetColumn0 < lastOffset.column)
    ) {
      throw new Error("Section offsets must be ordered and non-overlapping.");
    }

    lastOffset = offset;

    return {
      offsetLine0,
      offsetColumn0,
      map: section.map,
      sourceMapConsumer: null,
    };
  });

  function originalPositionFor({
    columnNumber,
    lineNumber,
  }) {
    // Error.prototype.stack columns are 1-based (like most IDEs) but ASTs are 0-based.
    const column0 = columnNumber - 1;
    const line0 = lineNumber - 1;

    // Sections must not overlap and must be sorted: https://tc39.es/source-map/#section-object
    // Therefore the last section that has an offset less than or equal to the frame is the applicable one.
    let left = 0;
    let right = sections.length - 1;
    let section = null;

    while (left <= right) {
      // fast Math.floor
      const middle = ~~((left + right) / 2);
      const currentSection = sections[middle];

      if (
        currentSection.offsetLine0 < line0 ||
        (currentSection.offsetLine0 === line0 &&
          currentSection.offsetColumn0 <= column0)
      ) {
        section = currentSection;
        left = middle + 1;
      } else {
        right = middle - 1;
      }
    }

    if (section == null) {
      // TODO maybe fall back to the runtime source instead of throwing?
      throw Error(
        `Could not find matching section for line:${lineNumber} and column:${columnNumber}`,
      );
    }

    if (section.sourceMapConsumer === null) {
      // Lazily parse the section only when it's needed.
      // $FlowFixMe[invalid-constructor] Flow no longer supports calling new on functions
      section.sourceMapConsumer = new SourceMapConsumer(section.map);
    }

    return section.sourceMapConsumer.originalPositionFor({
      // The mappings in a Source Map section are relative to the section offset.
      columnNumber: columnNumber - section.offsetColumn0,
      lineNumber: lineNumber - section.offsetLine0,
    });
  }

  return ({
    originalPositionFor,
  });
}
