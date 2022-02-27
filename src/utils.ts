import { ResolvedPos } from "prosemirror-model";
import { Match, SuggestionOption } from "./interface";

export function IsItemElement(event: MouseEvent): false | HTMLElement {
  if (!(event.target instanceof HTMLElement)) return false;

  const child = event.target.closest('.suggestion-item');
  if (child instanceof HTMLElement) {
    return child;
  } else {
    return false;
  }
}

export function getMatch<Item>($position: ResolvedPos, opts: SuggestionOption<Item>): Match {

}