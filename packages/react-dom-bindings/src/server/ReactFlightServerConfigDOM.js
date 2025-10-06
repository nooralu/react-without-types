/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// This module registers the host dispatcher so it needs to be imported
// even if no exports are used.
import { preload, preloadModule } from "./ReactDOMFlightServerHostDispatcher";

import { getCrossOriginString } from "../shared/crossOriginStrings";

// We use zero to represent the absence of an explicit precedence because it is
// small, smaller than how we encode undefined, and is unambiguous. We could use
// a different tuple structure to encode this instead but this makes the runtime
// cost cheaper by eliminating a type checks in more positions.

// prettier-ignore

export function createHints() {
  return new Set();
}

const NO_SCOPE = /*         */ 0b000000;
const NOSCRIPT_SCOPE = /*   */ 0b000001;
const PICTURE_SCOPE = /*    */ 0b000010;

export function createRootFormatContext() {
  return NO_SCOPE;
}

function processImg(props, formatContext) {
  // This should mirror the logic of pushImg in ReactFizzConfigDOM.
  const pictureOrNoScriptTagInScope = formatContext &
    (PICTURE_SCOPE | NOSCRIPT_SCOPE);
  const { src, srcSet } = props;
  if (
    props.loading !== "lazy" &&
    (src || srcSet) &&
    (typeof src === "string" || src == null) &&
    (typeof srcSet === "string" || srcSet == null) &&
    props.fetchPriority !== "low" &&
    !pictureOrNoScriptTagInScope &&
    // We exclude data URIs in src and srcSet since these should not be preloaded
    !(
      typeof src === "string" &&
      src[4] === ":" &&
      (src[0] === "d" || src[0] === "D") &&
      (src[1] === "a" || src[1] === "A") &&
      (src[2] === "t" || src[2] === "T") &&
      (src[3] === "a" || src[3] === "A")
    ) &&
    !(
      typeof srcSet === "string" &&
      srcSet[4] === ":" &&
      (srcSet[0] === "d" || srcSet[0] === "D") &&
      (srcSet[1] === "a" || srcSet[1] === "A") &&
      (srcSet[2] === "t" || srcSet[2] === "T") &&
      (srcSet[3] === "a" || srcSet[3] === "A")
    )
  ) {
    // We have a suspensey image and ought to preload it to optimize the loading of display blocking
    // resumableState.
    const sizes = typeof props.sizes === "string" ? props.sizes : undefined;

    const crossOrigin = getCrossOriginString(props.crossOrigin);

    preload(
      // The preload() API requires a href but if we have an imageSrcSet then that will take precedence.
      // We already remove the href anyway in both Fizz and Fiber due to a Safari bug so the empty string
      // will never actually appear in the DOM.
      src || "",
      "image",
      {
        imageSrcSet: srcSet,
        imageSizes: sizes,
        crossOrigin: crossOrigin,
        integrity: props.integrity,
        type: props.type,
        fetchPriority: props.fetchPriority,
        referrerPolicy: props.referrerPolicy,
      },
    );
  }
}

function processLink(props, formatContext) {
  const noscriptTagInScope = formatContext & NOSCRIPT_SCOPE;
  const rel = props.rel;
  const href = props.href;
  if (
    noscriptTagInScope ||
    props.itemProp != null ||
    typeof rel !== "string" ||
    typeof href !== "string" ||
    href === ""
  ) {
    // We shouldn't preload resources that are in noscript or have no configuration.
    return;
  }

  switch (rel) {
    case "preload": {
      preload(href, props.as, {
        crossOrigin: props.crossOrigin,
        integrity: props.integrity,
        nonce: props.nonce,
        type: props.type,
        fetchPriority: props.fetchPriority,
        referrerPolicy: props.referrerPolicy,
        imageSrcSet: props.imageSrcSet,
        imageSizes: props.imageSizes,
        media: props.media,
      });
      return;
    }
    case "modulepreload": {
      preloadModule(href, {
        as: props.as,
        crossOrigin: props.crossOrigin,
        integrity: props.integrity,
        nonce: props.nonce,
      });
      return;
    }
    case "stylesheet": {
      preload(href, "stylesheet", {
        crossOrigin: props.crossOrigin,
        integrity: props.integrity,
        nonce: props.nonce,
        type: props.type,
        fetchPriority: props.fetchPriority,
        referrerPolicy: props.referrerPolicy,
        media: props.media,
      });
      return;
    }
  }
}

export function getChildFormatContext(
  parentContext,
  type,
  props,
) {
  switch (type) {
    case "img":
      processImg(props, parentContext);
      return parentContext;
    case "link":
      processLink(props, parentContext);
      return parentContext;
    case "picture":
      return parentContext | PICTURE_SCOPE;
    case "noscript":
      return parentContext | NOSCRIPT_SCOPE;
    default:
      return parentContext;
  }
}
