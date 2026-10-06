import type { WhiteboardElement } from "@/types/whiteboard";

function shouldReplace(current: WhiteboardElement, incoming: WhiteboardElement): boolean {
  return (
    incoming.version > current.version ||
    (incoming.version === current.version && incoming.versionNonce > current.versionNonce)
  );
}

export interface WhiteboardElementMergeResult {
  elements: WhiteboardElement[];
  appliedElements: WhiteboardElement[];
}

export function mergeWhiteboardElements(
  current: WhiteboardElement[],
  incoming: WhiteboardElement[],
): WhiteboardElementMergeResult {
  const elementsById = new Map(current.map((element) => [element.id, element]));
  const order = current.map((element) => element.id);
  const appliedIds: string[] = [];
  const appliedIdSet = new Set<string>();

  for (const incomingElement of incoming) {
    const currentElement = elementsById.get(incomingElement.id);
    if (!currentElement) {
      elementsById.set(incomingElement.id, incomingElement);
      order.push(incomingElement.id);
      if (!appliedIdSet.has(incomingElement.id)) {
        appliedIds.push(incomingElement.id);
        appliedIdSet.add(incomingElement.id);
      }
      continue;
    }

    if (shouldReplace(currentElement, incomingElement)) {
      elementsById.set(incomingElement.id, incomingElement);
      if (!appliedIdSet.has(incomingElement.id)) {
        appliedIds.push(incomingElement.id);
        appliedIdSet.add(incomingElement.id);
      }
    }
  }

  return {
    elements: order.map((id) => elementsById.get(id) as WhiteboardElement),
    appliedElements: appliedIds.map((id) => elementsById.get(id) as WhiteboardElement),
  };
}
