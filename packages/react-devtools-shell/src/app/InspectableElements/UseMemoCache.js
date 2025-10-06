import * as React from "react";
import { c as useMemoCache } from "react/compiler-runtime";

export default function UseMemoCache() {
  useMemoCache(1);

  return null;
}
