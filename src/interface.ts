import { EditorState, Plugin, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

export interface SuggestionState<Item> {
  active: boolean;
  items?: Item[];
  pending: boolean;
  index: number;
  searchText?: string;
  match?: SuggestionMatch;
};

export interface SuggestionMatcher {
  exec(this: SuggestionMatcher, text: string): void;
  query: string,
  index: number,
  length: number,
  valid: boolean,
  [key: string]: any;
}

export interface SuggestionOption<Item> {
  match: {
    char: string,
    /** @default false */
    allowSpace?: boolean,
    /** @default false */
    allowPrefixChar?: boolean,
  }

  transaction: {
    setSuggestionItems(query: string, done: (item: Item[]) => void): void;
    select(view: EditorView, state: EditorState, plugin: Plugin<SuggestionState<Item>>, opts: SuggestionOption<Item>, item: Item, match: SuggestionMatch): void;
  }
  view: {
    activeClass: string;
    decorationClass: string;
    suggestionItem(item: Item): string | HTMLElement
    pending?(): string | HTMLElement;
    noResult?(): string | HTMLElement;
  }
};

export interface SuggestionMatch {
  range: {
    from: number,
    to: number,
  };
  queryText: string,
}