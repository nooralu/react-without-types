/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { StoreContext } from "../context";

const SuspenseTreeStateContext = createContext(null);
SuspenseTreeStateContext.displayName = "SuspenseTreeStateContext";

const SuspenseTreeDispatcherContext = createContext(null);
SuspenseTreeDispatcherContext.displayName = "SuspenseTreeDispatcherContext";

function getDefaultRootID(store) {
  const designatedRootID = store.roots.find((rootID) => {
    const suspense = store.getSuspenseByID(rootID);
    return (
      store.supportsTogglingSuspense(rootID) &&
      suspense !== null &&
      suspense.children.length > 1
    );
  });

  return designatedRootID === undefined ? null : designatedRootID;
}

function getInitialState(store) {
  let initialState;
  const uniqueSuspendersOnly = true;
  const selectedRootID = getDefaultRootID(store);
  // TODO: Default to nearest from inspected
  if (selectedRootID === null) {
    initialState = {
      selectedSuspenseID: null,
      lineage: null,
      roots: store.roots,
      selectedRootID,
      timeline: [],
      timelineIndex: -1,
      hoveredTimelineIndex: -1,
      uniqueSuspendersOnly,
      playing: false,
    };
  } else {
    const timeline = store.getSuspendableDocumentOrderSuspense(
      selectedRootID,
      uniqueSuspendersOnly,
    );
    const timelineIndex = timeline.length - 1;
    const selectedSuspenseID = timelineIndex === -1
      ? null
      : timeline[timelineIndex];
    const lineage = selectedSuspenseID !== null
      ? store.getSuspenseLineage(selectedSuspenseID)
      : [];
    initialState = {
      selectedSuspenseID,
      lineage,
      roots: store.roots,
      selectedRootID,
      timeline,
      timelineIndex,
      hoveredTimelineIndex: -1,
      uniqueSuspendersOnly,
      playing: false,
    };
  }

  return initialState;
}

function SuspenseTreeContextController({ children }) {
  const store = useContext(StoreContext);
  // This reducer is created inline because it needs access to the Store.
  // The store is mutable, but the Store itself is global and lives for the lifetime of the DevTools,
  // so it's okay for the reducer to have an empty dependencies array.
  const reducer = useMemo(
    () =>
    (
      state,
      action,
    ) => {
      switch (action.type) {
        case "HANDLE_SUSPENSE_TREE_MUTATION": {
          let { selectedSuspenseID } = state;
          // If the currently-selected Element has been removed from the tree, update selection state.
          const removedIDs = action.payload[0];
          // Find the closest parent that wasn't removed during this batch.
          // We deduce the parent-child mapping from removedIDs (id -> parentID)
          // because by now it's too late to read them from the store.

          while (
            selectedSuspenseID !== null &&
            removedIDs.has(selectedSuspenseID)
          ) {
            // $FlowExpectedError[incompatible-type]
            selectedSuspenseID = removedIDs.get(selectedSuspenseID);
          }
          if (selectedSuspenseID === 0) {
            // The whole root was removed.
            selectedSuspenseID = null;
          }

          let selectedTimelineID = state.timeline === null
            ? null
            : state.timeline[state.timelineIndex];
          while (
            selectedTimelineID !== null &&
            removedIDs.has(selectedTimelineID)
          ) {
            // $FlowExpectedError[incompatible-type]
            selectedTimelineID = removedIDs.get(selectedTimelineID);
          }

          let nextRootID = state.selectedRootID;
          if (selectedTimelineID !== null && selectedTimelineID !== 0) {
            nextRootID = store.getSuspenseRootIDForSuspense(selectedTimelineID);
          }
          if (nextRootID === null) {
            nextRootID = getDefaultRootID(store);
          }

          const nextTimeline = nextRootID === null
            ? []
            // TODO: Handle different timeline modes (e.g. random order)
            : store.getSuspendableDocumentOrderSuspense(
              nextRootID,
              state.uniqueSuspendersOnly,
            );

          let nextTimelineIndex =
            selectedTimelineID === null || nextTimeline.length === 0
              ? -1
              : nextTimeline.indexOf(selectedTimelineID);
          if (nextTimeline.length > 0 && nextTimelineIndex === -1) {
            nextTimelineIndex = nextTimeline.length - 1;
            selectedSuspenseID = nextTimeline[nextTimelineIndex];
          }

          if (selectedSuspenseID === null && nextTimeline.length > 0) {
            selectedSuspenseID = nextTimeline[nextTimeline.length - 1];
          }

          const nextLineage = selectedSuspenseID !== null &&
              state.selectedSuspenseID !== selectedSuspenseID
            ? store.getSuspenseLineage(selectedSuspenseID)
            : state.lineage;

          return {
            ...state,
            lineage: nextLineage,
            roots: store.roots,
            selectedRootID: nextRootID,
            selectedSuspenseID,
            timeline: nextTimeline,
            timelineIndex: nextTimelineIndex,
          };
        }
        case "SELECT_SUSPENSE_BY_ID": {
          const selectedSuspenseID = action.payload;
          const selectedRootID = store.getSuspenseRootIDForSuspense(
            selectedSuspenseID,
          );

          return {
            ...state,
            selectedSuspenseID,
            selectedRootID,
            playing: false, // pause
          };
        }
        case "SET_SUSPENSE_LINEAGE": {
          const suspenseID = action.payload;
          const lineage = store.getSuspenseLineage(suspenseID);
          const selectedRootID = store.getSuspenseRootIDForSuspense(suspenseID);

          return {
            ...state,
            lineage,
            selectedSuspenseID: suspenseID,
            selectedRootID,
            playing: false, // pause
          };
        }
        case "SET_SUSPENSE_TIMELINE": {
          const previousMilestoneIndex = state.timelineIndex;
          const previousTimeline = state.timeline;
          const nextTimeline = action.payload[0];
          const nextRootID = action.payload[1];
          const nextUniqueSuspendersOnly = action.payload[2];
          let nextLineage = state.lineage;
          let nextMilestoneIndex = -1;
          let nextSelectedSuspenseID = state.selectedSuspenseID;
          // Action has indicated it has no preference for the selected Node.
          // Try to reconcile the new timeline with the previous index.
          if (
            nextRootID === null &&
            previousTimeline !== null &&
            previousMilestoneIndex !== null
          ) {
            const previousMilestoneID =
              previousTimeline[previousMilestoneIndex];
            nextMilestoneIndex = nextTimeline.indexOf(previousMilestoneID);
            if (nextMilestoneIndex === -1 && nextTimeline.length > 0) {
              nextMilestoneIndex = nextTimeline.length - 1;
              nextSelectedSuspenseID = nextTimeline[nextMilestoneIndex];
              nextLineage = store.getSuspenseLineage(nextSelectedSuspenseID);
            }
          } else if (nextRootID !== null) {
            nextMilestoneIndex = nextTimeline.length - 1;
            nextSelectedSuspenseID = nextTimeline[nextMilestoneIndex];
            nextLineage = store.getSuspenseLineage(nextSelectedSuspenseID);
          }

          return {
            ...state,
            selectedSuspenseID: nextSelectedSuspenseID,
            lineage: nextLineage,
            selectedRootID: nextRootID === null
              ? state.selectedRootID
              : nextRootID,
            timeline: nextTimeline,
            timelineIndex: nextMilestoneIndex,
            uniqueSuspendersOnly: nextUniqueSuspendersOnly,
          };
        }
        case "SUSPENSE_SET_TIMELINE_INDEX": {
          const nextTimelineIndex = action.payload;
          const nextSelectedSuspenseID = state.timeline[nextTimelineIndex];
          const nextLineage = store.getSuspenseLineage(
            nextSelectedSuspenseID,
          );

          return {
            ...state,
            lineage: nextLineage,
            selectedSuspenseID: nextSelectedSuspenseID,
            timelineIndex: nextTimelineIndex,
            playing: false, // pause
          };
        }
        case "SUSPENSE_SKIP_TIMELINE_INDEX": {
          const direction = action.payload;
          const nextTimelineIndex = state.timelineIndex + (direction ? 1 : -1);
          if (
            nextTimelineIndex < 0 ||
            nextTimelineIndex > state.timeline.length - 1
          ) {
            return state;
          }
          const nextSelectedSuspenseID = state.timeline[nextTimelineIndex];
          const nextLineage = store.getSuspenseLineage(
            nextSelectedSuspenseID,
          );
          return {
            ...state,
            lineage: nextLineage,
            selectedSuspenseID: nextSelectedSuspenseID,
            timelineIndex: nextTimelineIndex,
            playing: false, // pause
          };
        }
        case "SUSPENSE_PLAY_PAUSE": {
          const mode = action.payload;

          let nextTimelineIndex = state.timelineIndex;
          let nextSelectedSuspenseID = state.selectedSuspenseID;
          let nextLineage = state.lineage;

          if (
            !state.playing &&
            mode !== "pause" &&
            nextTimelineIndex === state.timeline.length - 1
          ) {
            // If we're restarting at the end. Then loop around and start again from the beginning.
            nextTimelineIndex = 0;
            nextSelectedSuspenseID = state.timeline[nextTimelineIndex];
            nextLineage = store.getSuspenseLineage(nextSelectedSuspenseID);
          }

          return {
            ...state,
            lineage: nextLineage,
            selectedSuspenseID: nextSelectedSuspenseID,
            timelineIndex: nextTimelineIndex,
            playing: mode === "toggle" ? !state.playing : mode === "play",
          };
        }
        case "SUSPENSE_PLAY_TICK": {
          if (!state.playing) {
            // We stopped but haven't yet cleaned up the callback. Noop.
            return state;
          }
          // Advance time
          const nextTimelineIndex = state.timelineIndex + 1;
          if (nextTimelineIndex > state.timeline.length - 1) {
            return state;
          }
          const nextSelectedSuspenseID = state.timeline[nextTimelineIndex];
          const nextLineage = store.getSuspenseLineage(
            nextSelectedSuspenseID,
          );
          // Stop once we reach the end.
          const nextPlaying = nextTimelineIndex < state.timeline.length - 1;
          return {
            ...state,
            lineage: nextLineage,
            selectedSuspenseID: nextSelectedSuspenseID,
            timelineIndex: nextTimelineIndex,
            playing: nextPlaying,
          };
        }
        case "TOGGLE_TIMELINE_FOR_ID": {
          const suspenseID = action.payload;
          const timelineIndexForSuspenseID = state.timeline.indexOf(suspenseID);
          if (timelineIndexForSuspenseID === -1) {
            // This boundary is no longer in the timeline.
            return state;
          }
          const nextTimelineIndex = timelineIndexForSuspenseID === 0
            // For roots, there's no toggling. It's always just jump to beginning.
            ? 0
            // For boundaries, we'll either jump to before or after its reveal depending
            // on if we're currently displaying it or not according to the timeline.
            : state.timelineIndex < timelineIndexForSuspenseID
            // We're currently before this suspense boundary has been revealed so we
            // should jump ahead to reveal it.
            ? timelineIndexForSuspenseID
            // Otherwise, if we're currently showing it, jump to right before to hide it.
            : timelineIndexForSuspenseID - 1;
          const nextSelectedSuspenseID = state.timeline[nextTimelineIndex];
          const nextLineage = store.getSuspenseLineage(
            nextSelectedSuspenseID,
          );
          return {
            ...state,
            lineage: nextLineage,
            selectedSuspenseID: nextSelectedSuspenseID,
            timelineIndex: nextTimelineIndex,
            playing: false, // pause
          };
        }
        case "HOVER_TIMELINE_FOR_ID": {
          const suspenseID = action.payload;
          const timelineIndexForSuspenseID = state.timeline.indexOf(suspenseID);
          return {
            ...state,
            hoveredTimelineIndex: timelineIndexForSuspenseID,
          };
        }
        default:
          throw new Error(`Unrecognized action "${action.type}"`);
      }
    },
    [],
  );

  const [state, dispatch] = useReducer(reducer, store, getInitialState);

  const initialRevision = useMemo(() => store.revisionSuspense, [store]);
  // We're currently storing everything Suspense related in the same Store as
  // Components. However, most reads are currently stateless. This ensures
  // the latest state is always read from the Store.
  useEffect(() => {
    const handleSuspenseTreeMutated = ([removedElementIDs]) => {
      dispatch({
        type: "HANDLE_SUSPENSE_TREE_MUTATION",
        payload: [removedElementIDs],
      });
    };

    // Since this is a passive effect, the tree may have been mutated before our initial subscription.
    if (store.revisionSuspense !== initialRevision) {
      // At the moment, we can treat this as a mutation.
      handleSuspenseTreeMutated([new Map()]);
    }

    store.addListener("suspenseTreeMutated", handleSuspenseTreeMutated);
    return () =>
      store.removeListener("suspenseTreeMutated", handleSuspenseTreeMutated);
  }, [initialRevision, store]);

  const transitionDispatch = useMemo(
    () => (action) =>
      startTransition(() => {
        dispatch(action);
      }),
    [dispatch],
  );

  return (
    <SuspenseTreeStateContext.Provider value={state}>
      <SuspenseTreeDispatcherContext.Provider value={transitionDispatch}>
        {children}
      </SuspenseTreeDispatcherContext.Provider>
    </SuspenseTreeStateContext.Provider>
  );
}

export {
  SuspenseTreeContextController,
  SuspenseTreeDispatcherContext,
  SuspenseTreeStateContext,
};
