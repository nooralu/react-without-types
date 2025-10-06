/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react";
import { useContext } from "react";

import { ContextMenuContext } from "../context";
import {
  copyInspectedElementPath as copyInspectedElementPathAPI,
  storeAsGlobal as storeAsGlobalAPI,
} from "../../../backendAPI";
import Icon from "../Icon";
import ContextMenuContainer from "../../ContextMenu/ContextMenuContainer";

import styles from "./KeyValueContextMenuContainer.css";

export default function KeyValueContextMenuContainer({
  children,
  anchorElementRef,
  store,
  attributeSourceCanBeInspected,
  bridge,
  id,
  path,
  canBeCopiedToClipboard,
}) {
  const {
    isEnabledForInspectedElement: isContextMenuEnabledForInspectedElement,
    viewAttributeSourceFunction,
  } = useContext(ContextMenuContext);

  const menuItems = React.useMemo(() => {
    const items = [
      {
        onClick: () => {
          const rendererID = store.getRendererIDForElement(id);
          if (rendererID !== null) {
            storeAsGlobalAPI({
              bridge,
              id,
              path,
              rendererID,
            });
          }
        },
        content: (
          <span className={styles.ContextMenuItemContent}>
            <Icon type="store-as-global-variable" />
            <label>Store as global variable</label>
          </span>
        ),
      },
    ];

    if (canBeCopiedToClipboard) {
      items.unshift({
        onClick: () => {
          const rendererID = store.getRendererIDForElement(id);
          if (rendererID !== null) {
            copyInspectedElementPathAPI({
              bridge,
              id,
              path,
              rendererID,
            });
          }
        },
        content: (
          <span className={styles.ContextMenuItemContent}>
            <Icon type="copy" />
            <label>Copy value to clipboard</label>
          </span>
        ),
      });
    }

    if (viewAttributeSourceFunction != null && attributeSourceCanBeInspected) {
      items.push({
        onClick: () => viewAttributeSourceFunction(id, path),
        content: (
          <span className={styles.ContextMenuItemContent}>
            <Icon type="code" />
            <label>Go to definition</label>
          </span>
        ),
      });
    }
    return items;
  }, [
    store,
    viewAttributeSourceFunction,
    attributeSourceCanBeInspected,
    canBeCopiedToClipboard,
    bridge,
    id,
    path,
  ]);

  if (!isContextMenuEnabledForInspectedElement) {
    return children;
  }

  return (
    <>
      {children}
      <ContextMenuContainer
        anchorElementRef={anchorElementRef}
        items={menuItems}
      />
    </>
  );
}
