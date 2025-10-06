/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";

import ButtonIcon from "../ButtonIcon";
import Button from "../Button";

import useOpenResource from "../useOpenResource";

function InspectedElementViewSourceButton({
  source,
  symbolicatedSourcePromise,
}) {
  return (
    <React.Suspense
      fallback={
        <Button disabled={true} title="Loading source maps...">
          <ButtonIcon type="view-source" />
        </Button>
      }
    >
      <ActualSourceButton
        source={source}
        symbolicatedSourcePromise={symbolicatedSourcePromise}
      />
    </React.Suspense>
  );
}

function ActualSourceButton({
  source,
  symbolicatedSourcePromise,
}) {
  const symbolicatedSource = symbolicatedSourcePromise == null
    ? null
    : React.use(symbolicatedSourcePromise);

  const [buttonIsEnabled, viewSource] = useOpenResource(
    source,
    symbolicatedSource == null ? null : symbolicatedSource.location,
  );
  return (
    <Button
      disabled={!buttonIsEnabled}
      onClick={viewSource}
      title="View source for this element"
    >
      <ButtonIcon type="view-source" />
    </Button>
  );
}

export default InspectedElementViewSourceButton;
