/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { TerraformElement, TerraformStack } from "cdktf";
import { makeUniqueId } from "cdktf/lib/private/unique";
import { Node } from "constructs";

function allocateLogicalId(tfElement: TerraformElement | Node): string {
  const node = TerraformElement.isTerraformElement(tfElement)
    ? tfElement.node
    : tfElement;
  const stack = TerraformElement.isTerraformElement(tfElement)
    ? tfElement.cdktfStack
    : TerraformStack.of(tfElement as any);

  // This is the previous behavior, which we want for now.
  const stackIndex = node.scopes.indexOf(stack);

  const components = node.scopes.slice(stackIndex + 1).map((c) => c.node.id);
  return components.length > 0 ? makeUniqueId(components) : "";
}

export function setOldId(tfElement: TerraformElement): void {
  tfElement.overrideLogicalId(allocateLogicalId(tfElement));
}
