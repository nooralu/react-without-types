/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import noop from "shared/noop";

// This should line up with NoEventPriority from react-reconciler/src/ReactEventPriorities
// but we can't depend on the react-reconciler from this isomorphic code.
export const NoEventPriority = 0;

function requestFormReset(element) {
  throw new Error(
    "Invalid form element. requestFormReset must be passed a form that was " +
      "rendered by React.",
  );
}

const DefaultDispatcher = {
  f /* flushSyncWork */: noop,
  r /* requestFormReset */: requestFormReset,
  D /* prefetchDNS */: noop,
  C /* preconnect */: noop,
  L /* preload */: noop,
  m /* preloadModule */: noop,
  X /* preinitScript */: noop,
  S /* preinitStyle */: noop,
  M /* preinitModuleScript */: noop,
};

const Internals = {
  d /* ReactDOMCurrentDispatcher */: DefaultDispatcher,
  p /* currentUpdatePriority */: NoEventPriority,
  findDOMNode: null,
};

export default Internals;
