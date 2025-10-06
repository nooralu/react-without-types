/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  __DEBUG__,
  SUSPENSE_TREE_OPERATION_ADD,
  SUSPENSE_TREE_OPERATION_REMOVE,
  SUSPENSE_TREE_OPERATION_REORDER_CHILDREN,
  SUSPENSE_TREE_OPERATION_RESIZE,
  SUSPENSE_TREE_OPERATION_SUSPENDERS,
  TREE_OPERATION_ADD,
  TREE_OPERATION_REMOVE,
  TREE_OPERATION_REMOVE_ROOT,
  TREE_OPERATION_REORDER_CHILDREN,
  TREE_OPERATION_SET_SUBTREE_MODE,
  TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS,
  TREE_OPERATION_UPDATE_TREE_BASE_DURATION,
} from "react-devtools-shared/src/constants";
import {
  parseElementDisplayNameFromBackend,
  utfDecodeStringWithRanges,
} from "react-devtools-shared/src/utils";
import { ElementTypeRoot } from "react-devtools-shared/src/frontend/types";
import ProfilerStore from "react-devtools-shared/src/devtools/ProfilerStore";

const debug = (methodName, ...args) => {
  if (__DEBUG__) {
    console.log(
      `%cCommitTreeBuilder %c${methodName}`,
      "color: pink; font-weight: bold;",
      "font-weight: bold;",
      ...args,
    );
  }
};

const rootToCommitTreeMap = new Map();

export function getCommitTree({
  commitIndex,
  profilerStore,
  rootID,
}) {
  if (!rootToCommitTreeMap.has(rootID)) {
    rootToCommitTreeMap.set(rootID, []);
  }

  const commitTrees = rootToCommitTreeMap.get(
    rootID,
  );
  if (commitIndex < commitTrees.length) {
    return commitTrees[commitIndex];
  }

  const { profilingData } = profilerStore;
  if (profilingData === null) {
    throw Error(`No profiling data available`);
  }

  const dataForRoot = profilingData.dataForRoots.get(rootID);
  if (dataForRoot == null) {
    throw Error(`Could not find profiling data for root "${rootID}"`);
  }

  const { operations } = dataForRoot;
  if (operations.length <= commitIndex) {
    throw Error(
      `getCommitTree(): Invalid commit "${commitIndex}" for root "${rootID}". There are only "${operations.length}" commits.`,
    );
  }

  let commitTree = null;
  for (let index = commitTrees.length; index <= commitIndex; index++) {
    // Commits are generated sequentially and cached.
    // If this is the very first commit, start with the cached snapshot and apply the first mutation.
    // Otherwise load (or generate) the previous commit and append a mutation to it.
    if (index === 0) {
      const nodes = new Map();

      // Construct the initial tree.
      recursivelyInitializeTree(rootID, 0, nodes, dataForRoot);

      // Mutate the tree
      if (operations != null && index < operations.length) {
        commitTree = updateTree({ nodes, rootID }, operations[index]);

        if (__DEBUG__) {
          __printTree(commitTree);
        }

        commitTrees.push(commitTree);
      }
    } else {
      const previousCommitTree = commitTrees[index - 1];
      commitTree = updateTree(previousCommitTree, operations[index]);

      if (__DEBUG__) {
        __printTree(commitTree);
      }

      commitTrees.push(commitTree);
    }
  }

  return commitTree;
}

function recursivelyInitializeTree(
  id,
  parentID,
  nodes,
  dataForRoot,
) {
  const node = dataForRoot.snapshots.get(id);
  if (node != null) {
    nodes.set(id, {
      id,
      children: node.children,
      displayName: node.displayName,
      hocDisplayNames: node.hocDisplayNames,
      key: node.key,
      parentID,
      treeBaseDuration: (dataForRoot.initialTreeBaseDurations.get(
        id,
      )),
      type: node.type,
      compiledWithForget: node.compiledWithForget,
    });

    node.children.forEach((childID) =>
      recursivelyInitializeTree(childID, id, nodes, dataForRoot)
    );
  }
}

function updateTree(
  commitTree,
  operations,
) {
  // Clone the original tree so edits don't affect it.
  const nodes = new Map(commitTree.nodes);

  // Clone nodes before mutating them so edits don't affect them.
  const getClonedNode = (id) => {
    // $FlowFixMe[prop-missing] - recommended fix is to use object spread operator
    const clonedNode = Object.assign(
      {},
      nodes.get(id),
    );
    nodes.set(id, clonedNode);
    return clonedNode;
  };

  let i = 2;
  let id = null;

  // Reassemble the string table.
  const stringTable = [
    null, // ID = 0 corresponds to the null string.
  ];
  const stringTableSize = operations[i++];
  const stringTableEnd = i + stringTableSize;
  while (i < stringTableEnd) {
    const nextLength = operations[i++];
    const nextString = utfDecodeStringWithRanges(
      operations,
      i,
      i + nextLength - 1,
    );
    stringTable.push(nextString);
    i += nextLength;
  }

  while (i < operations.length) {
    const operation = operations[i];

    switch (operation) {
      case TREE_OPERATION_ADD: {
        id = operations[i + 1];
        const type = operations[i + 2];

        i += 3;

        if (nodes.has(id)) {
          throw new Error(
            `Commit tree already contains fiber "${id}". This is a bug in React DevTools.`,
          );
        }

        if (type === ElementTypeRoot) {
          i++; // isStrictModeCompliant
          i++; // Profiling flag
          i++; // supportsStrictMode flag
          i++; // hasOwnerMetadata flag
          i++; // supportsTogglingSuspense flag

          if (__DEBUG__) {
            debug("Add", `new root fiber ${id}`);
          }

          const node = {
            children: [],
            displayName: null,
            hocDisplayNames: null,
            id,
            key: null,
            parentID: 0,
            treeBaseDuration: 0, // This will be updated by a subsequent operation
            type,
            compiledWithForget: false,
          };

          nodes.set(id, node);
        } else {
          const parentID = operations[i];
          i++;

          i++; // ownerID

          const displayNameStringID = operations[i];
          const displayName = stringTable[displayNameStringID];
          i++;

          const keyStringID = operations[i];
          const key = stringTable[keyStringID];
          i++;

          // skip name prop
          i++;

          if (__DEBUG__) {
            debug(
              "Add",
              `fiber ${id} (${displayName || "null"}) as child of ${parentID}`,
            );
          }

          const parentNode = getClonedNode(parentID);
          parentNode.children = parentNode.children.concat(id);

          const { formattedDisplayName, hocDisplayNames, compiledWithForget } =
            parseElementDisplayNameFromBackend(displayName, type);

          const node = {
            children: [],
            displayName: formattedDisplayName,
            hocDisplayNames: hocDisplayNames,
            id,
            key,
            parentID,
            treeBaseDuration: 0, // This will be updated by a subsequent operation
            type,
            compiledWithForget,
          };

          nodes.set(id, node);
        }

        break;
      }
      case TREE_OPERATION_REMOVE: {
        const removeLength = operations[i + 1];
        i += 2;

        for (let removeIndex = 0; removeIndex < removeLength; removeIndex++) {
          id = operations[i];
          i++;

          if (!nodes.has(id)) {
            throw new Error(
              `Commit tree does not contain fiber "${id}". This is a bug in React DevTools.`,
            );
          }

          const node = getClonedNode(id);
          const parentID = node.parentID;

          nodes.delete(id);

          if (!nodes.has(parentID)) {
            // No-op
          } else {
            const parentNode = getClonedNode(parentID);

            if (__DEBUG__) {
              debug("Remove", `fiber ${id} from parent ${parentID}`);
            }

            parentNode.children = parentNode.children.filter(
              (childID) => childID !== id,
            );
          }
        }
        break;
      }
      case TREE_OPERATION_REMOVE_ROOT: {
        throw Error("Operation REMOVE_ROOT is not supported while profiling.");
      }
      case TREE_OPERATION_REORDER_CHILDREN: {
        id = operations[i + 1];
        const numChildren = operations[i + 2];
        const children = operations.slice(
          i + 3,
          i + 3 + numChildren,
        );

        i = i + 3 + numChildren;

        if (__DEBUG__) {
          debug("Re-order", `fiber ${id} children ${children.join(",")}`);
        }

        const node = getClonedNode(id);
        node.children = Array.from(children);

        break;
      }
      case TREE_OPERATION_SET_SUBTREE_MODE: {
        id = operations[i + 1];
        const mode = operations[i + 1];

        i += 3;

        if (__DEBUG__) {
          debug("Subtree mode", `Subtree with root ${id} set to mode ${mode}`);
        }
        break;
      }
      case TREE_OPERATION_UPDATE_TREE_BASE_DURATION: {
        id = operations[i + 1];

        const node = getClonedNode(id);
        node.treeBaseDuration = operations[i + 2] / 1000; // Convert microseconds back to milliseconds;

        if (__DEBUG__) {
          debug(
            "Update",
            `fiber ${id} treeBaseDuration to ${node.treeBaseDuration}`,
          );
        }

        i += 3;
        break;
      }
      case TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS: {
        id = operations[i + 1];
        const numErrors = operations[i + 2];
        const numWarnings = operations[i + 3];

        i += 4;

        if (__DEBUG__) {
          debug(
            "Warnings and Errors update",
            `fiber ${id} has ${numErrors} errors and ${numWarnings} warnings`,
          );
        }
        break;
      }

      case SUSPENSE_TREE_OPERATION_ADD: {
        const fiberID = operations[i + 1];
        const parentID = operations[i + 2];
        const nameStringID = operations[i + 3];
        const numRects = operations[i + 4];
        const name = stringTable[nameStringID];

        if (__DEBUG__) {
          let rects;
          if (numRects === -1) {
            rects = "null";
          } else {
            rects = "[" +
              operations.slice(i + 5, i + 5 + numRects * 4).join(",") +
              "]";
          }
          debug(
            "Add suspense",
            `node ${fiberID} (name=${
              JSON.stringify(name)
            }, rects={${rects}}) under ${parentID}`,
          );
        }

        i += 5 + (numRects === -1 ? 0 : numRects * 4);
        break;
      }

      case SUSPENSE_TREE_OPERATION_REMOVE: {
        const removeLength = operations[i + 1];
        i += 2 + removeLength;

        break;
      }

      case SUSPENSE_TREE_OPERATION_REORDER_CHILDREN: {
        const suspenseID = operations[i + 1];
        const numChildren = operations[i + 2];
        const children = operations.slice(
          i + 3,
          i + 3 + numChildren,
        );

        i = i + 3 + numChildren;

        if (__DEBUG__) {
          debug(
            "Suspense re-order",
            `suspense ${suspenseID} children ${children.join(",")}`,
          );
        }

        break;
      }

      case SUSPENSE_TREE_OPERATION_RESIZE: {
        const suspenseID = operations[i + 1];
        const numRects = operations[i + 2];

        if (__DEBUG__) {
          if (numRects === -1) {
            debug("Suspense resize", `suspense ${suspenseID} rects null`);
          } else {
            const rects = operations.slice(
              i + 3,
              i + 3 + numRects * 4,
            );
            debug(
              "Suspense resize",
              `suspense ${suspenseID} rects [${rects.join(",")}]`,
            );
          }
        }

        i += 3 + (numRects === -1 ? 0 : numRects * 4);

        break;
      }

      case SUSPENSE_TREE_OPERATION_SUSPENDERS: {
        i++;
        const changeLength = operations[i++];

        for (let changeIndex = 0; changeIndex < changeLength; changeIndex++) {
          const suspenseNodeId = operations[i++];
          const hasUniqueSuspenders = operations[i++] === 1;
          const environmentNamesLength = operations[i++];
          i += environmentNamesLength;
          if (__DEBUG__) {
            debug(
              "Suspender changes",
              `Suspense node ${suspenseNodeId} unique suspenders set to ${
                String(hasUniqueSuspenders)
              } with ${String(environmentNamesLength)} environments`,
            );
          }
        }

        break;
      }

      default:
        throw Error(`Unsupported Bridge operation "${operation}"`);
    }
  }

  return {
    nodes,
    rootID: commitTree.rootID,
  };
}

export function invalidateCommitTrees() {
  rootToCommitTreeMap.clear();
}

// DEBUG
const __printTree = (commitTree) => {
  if (__DEBUG__) {
    const { nodes, rootID } = commitTree;
    console.group("__printTree()");
    const queue = [rootID, 0];
    while (queue.length > 0) {
      const id = queue.shift();
      const depth = queue.shift();

      // $FlowFixMe[incompatible-call]
      const node = nodes.get(id);
      if (node == null) {
        // $FlowFixMe[incompatible-type]
        throw Error(`Could not find node with id "${id}" in commit tree`);
      }

      console.log(
        // $FlowFixMe[incompatible-call]
        `${"•".repeat(depth)}${node.id}:${node.displayName || ""} ${
          node.key ? `key:"${node.key}"` : ""
        } (${node.treeBaseDuration})`,
      );

      node.children.forEach((childID) => {
        // $FlowFixMe[unsafe-addition]
        queue.push(childID, depth + 1);
      });
    }
    console.groupEnd();
  }
};
