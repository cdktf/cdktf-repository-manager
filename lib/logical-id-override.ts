/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { TerraformElement } from "cdktf";
import { Node } from "constructs";
import { makeUniqueId } from "./unique-id-override";

function allocateLogicalId(tfElement: TerraformElement | Node): string {
  const node = TerraformElement.isTerraformElement(tfElement)
    ? tfElement.node
    : tfElement;

  // This is the previous behavior, which we want for now.
  const stackIndex = 0;

  const components = node.scopes.slice(stackIndex + 1).map((c) => c.node.id);
  return components.length > 0 ? makeUniqueId(components, false) : "";
}

export function setOldId(tfElement: TerraformElement): void {
  tfElement.overrideLogicalId(allocateLogicalId(tfElement));
}
