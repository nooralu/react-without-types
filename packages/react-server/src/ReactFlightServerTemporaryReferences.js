/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const TEMPORARY_REFERENCE_TAG = Symbol.for("react.temporary.reference");

// eslint-disable-next-line no-unused-vars

export function createTemporaryReferenceSet() {
  return new WeakMap();
}

export function isOpaqueTemporaryReference(reference) {
  return reference.$$typeof === TEMPORARY_REFERENCE_TAG;
}

export function resolveTemporaryReference(
  temporaryReferences,
  temporaryReference,
) {
  return temporaryReferences.get(temporaryReference);
}

const proxyHandlers = {
  get: function (
    target,
    name,
    receiver,
  ) {
    switch (name) {
      // These names are read by the Flight runtime if you end up using the exports object.
      case "$$typeof":
        // These names are a little too common. We should probably have a way to
        // have the Flight runtime extract the inner target instead.
        return target.$$typeof;
      case "name":
        return undefined;
      case "displayName":
        return undefined;
      // We need to special case this because createElement reads it if we pass this
      // reference.
      case "defaultProps":
        return undefined;
      // React looks for debugInfo on thenables.
      case "_debugInfo":
        return undefined;
      // Avoid this attempting to be serialized.
      case "toJSON":
        return undefined;
      case Symbol.toPrimitive:
        // $FlowFixMe[prop-missing]
        return Object.prototype[Symbol.toPrimitive];
      case Symbol.toStringTag:
        // $FlowFixMe[prop-missing]
        return Object.prototype[Symbol.toStringTag];
      case "Provider":
        throw new Error(
          `Cannot render a Client Context Provider on the Server. ` +
            `Instead, you can export a Client Component wrapper ` +
            `that itself renders a Client Context Provider.`,
        );
      case "then":
        // Allow returning a temporary reference from an async function
        // Unlike regular Client References, a Promise would never have been serialized as
        // an opaque Temporary Reference, but instead would have been serialized as a
        // Promise on the server and so doesn't hit this path. So we can assume this wasn't
        // a Promise on the client.
        return undefined;
    }
    throw new Error(
      // eslint-disable-next-line react-internal/safe-string-coercion
      `Cannot access ${String(name)} on the server. ` +
        "You cannot dot into a temporary client reference from a server component. " +
        "You can only pass the value through to the client.",
    );
  },
  set: function () {
    throw new Error(
      "Cannot assign to a temporary client reference from a server module.",
    );
  },
};

export function createTemporaryReference(
  temporaryReferences,
  id,
) {
  const reference = Object.defineProperties(
    function () {
      throw new Error(
        `Attempted to call a temporary Client Reference from the server but it is on the client. ` +
          `It's not possible to invoke a client function from the server, it can ` +
          `only be rendered as a Component or passed to props of a Client Component.`,
      );
    },
    {
      $$typeof: { value: TEMPORARY_REFERENCE_TAG },
    },
  );
  const wrapper = new Proxy(reference, proxyHandlers);
  registerTemporaryReference(temporaryReferences, wrapper, id);
  return wrapper;
}

export function registerTemporaryReference(
  temporaryReferences,
  object,
  id,
) {
  temporaryReferences.set(object, id);
}
