/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// The subset of a Thenable required by things thrown by Suspense.
// This doesn't require a value to be passed to either handler.

// The subset of a Promise that React APIs rely on. This resolves a value.
// This doesn't require a return value neither from the handler nor the
// then function.

// This is an opaque type returned by decodeFormState on the server, but it's
// defined in this shared file because the same type is used by React on
// the client.

// Intrinsic GestureProvider. This type varies by Environment whether a particular
// renderer supports it.

// non-thenable

// The point where the Async Info started which might not be the same place it was awaited.

// Intrinsic ViewTransitionInstance. This type varies by Environment whether a particular
// renderer supports it.

// A SuspenseList row cannot include a nested Array since it's an easy mistake to not realize it
// is treated as a single row. A Fragment can be used to intentionally have multiple children as
// a single row.
