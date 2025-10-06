/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { enableTrustedTypesIntegration } from "shared/ReactFeatureFlags";
import { getFiberCurrentPropsFromNode } from "../../client/ReactDOMComponentTree";
import { startHostTransition } from "react-reconciler/src/ReactFiberReconciler";
import { didCurrentEventScheduleTransition } from "react-reconciler/src/ReactFiberRootScheduler";
import sanitizeURL from "react-dom-bindings/src/shared/sanitizeURL";
import { checkAttributeStringCoercion } from "shared/CheckStringCoercion";

import { SyntheticEvent } from "../SyntheticEvent";

function coerceFormActionProp(
  actionProp,
) {
  // This should match the logic in ReactDOMComponent
  if (
    actionProp == null ||
    typeof actionProp === "symbol" ||
    typeof actionProp === "boolean"
  ) {
    return null;
  } else if (typeof actionProp === "function") {
    return actionProp;
  } else {
    if (__DEV__) {
      checkAttributeStringCoercion(actionProp, "action");
    }
    return (sanitizeURL(
      enableTrustedTypesIntegration ? actionProp : "" + actionProp,
    ));
  }
}

function createFormDataWithSubmitter(
  form,
  submitter,
) {
  // The submitter's value should be included in the FormData.
  // It should be in the document order in the form.
  // Since the FormData constructor invokes the formdata event it also
  // needs to be available before that happens so after construction it's too
  // late. We use a temporary fake node for the duration of this event.
  // TODO: FormData takes a second argument that it's the submitter but this
  // is fairly new so not all browsers support it yet. Switch to that technique
  // when available.
  const temp = submitter.ownerDocument.createElement("input");
  temp.name = submitter.name;
  temp.value = submitter.value;
  if (form.id) {
    temp.setAttribute("form", form.id);
  }
  submitter.parentNode.insertBefore(temp, submitter);
  const formData = new FormData(form);
  temp.parentNode.removeChild(temp);
  return formData;
}

/**
 * This plugin invokes action functions on forms, inputs and buttons if
 * the form doesn't prevent default.
 */
function extractEvents(
  dispatchQueue,
  domEventName,
  maybeTargetInst,
  nativeEvent,
  nativeEventTarget,
  eventSystemFlags,
  targetContainer,
) {
  if (domEventName !== "submit") {
    return;
  }
  if (!maybeTargetInst || maybeTargetInst.stateNode !== nativeEventTarget) {
    // If we're inside a parent root that itself is a parent of this root, then
    // its deepest target won't be the actual form that's being submitted.
    return;
  }
  const formInst = maybeTargetInst;
  const form = nativeEventTarget;
  let action = coerceFormActionProp(
    (getFiberCurrentPropsFromNode(form)).action,
  );
  let submitter = nativeEvent.submitter;
  let submitterAction;
  if (submitter) {
    const submitterProps = getFiberCurrentPropsFromNode(submitter);
    submitterAction = submitterProps
      ? coerceFormActionProp(submitterProps.formAction)
      // The built-in Flow type is ?string, wider than the spec
      : (submitter.getAttribute("formAction"));
    if (submitterAction !== null) {
      // The submitter overrides the form action.
      action = submitterAction;
      // If the action is a function, we don't want to pass its name
      // value to the FormData since it's controlled by the server.
      submitter = null;
    }
  }

  const event = new SyntheticEvent(
    "action",
    "action",
    null,
    nativeEvent,
    nativeEventTarget,
  );

  function submitForm() {
    if (nativeEvent.defaultPrevented) {
      // An earlier event prevented form submission. If a transition update was
      // also scheduled, we should trigger a pending form status — even if
      // no action function was provided.
      if (didCurrentEventScheduleTransition()) {
        // We're going to set the pending form status, but because the submission
        // was prevented, we should not fire the action function.
        const formData = submitter
          ? createFormDataWithSubmitter(form, submitter)
          : new FormData(form);
        const pendingState = {
          pending: true,
          data: formData,
          method: form.method,
          action: action,
        };
        if (__DEV__) {
          Object.freeze(pendingState);
        }
        startHostTransition(
          formInst,
          pendingState,
          // Pass `null` as the action
          // TODO: Consider splitting up startHostTransition into two separate
          // functions, one that sets the form status and one that invokes
          // the action.
          null,
          formData,
        );
      } else {
        // No earlier event scheduled a transition. Exit without setting a
        // pending form status.
      }
    } else if (typeof action === "function") {
      // A form action was provided. Prevent native navigation.
      event.preventDefault();

      // Dispatch the action and set a pending form status.
      const formData = submitter
        ? createFormDataWithSubmitter(form, submitter)
        : new FormData(form);
      const pendingState = {
        pending: true,
        data: formData,
        method: form.method,
        action: action,
      };
      if (__DEV__) {
        Object.freeze(pendingState);
      }
      startHostTransition(formInst, pendingState, action, formData);
    } else {
      // No earlier event prevented the default submission, and no action was
      // provided. Exit without setting a pending form status.
    }
  }

  dispatchQueue.push({
    event,
    listeners: [
      {
        instance: null,
        listener: submitForm,
        currentTarget: form,
      },
    ],
  });
}

export { extractEvents };

export function dispatchReplayedFormAction(
  formInst,
  form,
  action,
  formData,
) {
  const pendingState = {
    pending: true,
    data: formData,
    method: form.method,
    action: action,
  };
  if (__DEV__) {
    Object.freeze(pendingState);
  }
  startHostTransition(formInst, pendingState, action, formData);
}
