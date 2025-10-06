/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// eslint-disable-next-line no-unused-vars

const CLIENT_REFERENCE_TAG = Symbol.for("react.client.reference");
const SERVER_REFERENCE_TAG = Symbol.for("react.server.reference");

export function isClientReference(reference) {
  return reference.$$typeof === CLIENT_REFERENCE_TAG;
}

export function isServerReference(reference) {
  return reference.$$typeof === SERVER_REFERENCE_TAG;
}

export function createClientReference(
  id,
  exportName,
  bundles,
  importMap,
) {
  return {
    $$typeof: CLIENT_REFERENCE_TAG,
    $$id: id,
    $$name: exportName,
    $$bundles: bundles,
    $$importMap: importMap,
  };
}

// $FlowFixMe[method-unbinding]
const FunctionBind = Function.prototype.bind;
// $FlowFixMe[method-unbinding]
const ArraySlice = Array.prototype.slice;
function bind() {
  // $FlowFixMe[incompatible-call]
  const newFn = FunctionBind.apply(this, arguments);
  if (this.$$typeof === SERVER_REFERENCE_TAG) {
    if (__DEV__) {
      const thisBind = arguments[0];
      if (thisBind != null) {
        console.error(
          'Cannot bind "this" of a Server Action. Pass null or undefined as the first argument to .bind().',
        );
      }
    }
    const args = ArraySlice.call(arguments, 1);
    const $$typeof = { value: SERVER_REFERENCE_TAG };
    const $$id = { value: this.$$id };
    const $$bound = { value: this.$$bound ? this.$$bound.concat(args) : args };
    return Object.defineProperties(
      newFn,
      __DEV__
        ? {
          $$typeof,
          $$id,
          $$bound,
          $$location: {
            value: this.$$location,
            configurable: true,
          },
          bind: { value: bind, configurable: true },
        }
        : {
          $$typeof,
          $$id,
          $$bound,
          bind: { value: bind, configurable: true },
        },
    );
  }
  return newFn;
}

export function registerServerReference(
  reference,
  id,
  exportName,
) {
  const $$typeof = { value: SERVER_REFERENCE_TAG };
  const $$id = {
    value: id + "#" + exportName,
    configurable: true,
  };
  const $$bound = { value: null, configurable: true };
  return Object.defineProperties(
    reference,
    __DEV__
      ? {
        $$typeof,
        $$id,
        $$bound,
        $$location: {
          value: Error("react-stack-top-frame"),
          configurable: true,
        },
        bind: { value: bind, configurable: true },
      }
      : {
        $$typeof,
        $$id,
        $$bound,
        bind: { value: bind, configurable: true },
      },
  );
}
