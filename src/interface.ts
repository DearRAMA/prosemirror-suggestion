import { Transaction } from "prosemirror-state";

export interface SuggestionState<Item> {
  active: boolean;
  items?: Item[];
  pending: boolean;
  index: number;
  searchText?: string;
  match?: Match;
};

export interface SuggestionRegexpMatch {
  exec(this: SuggestionRegexpMatch, text: string): void;
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
    setSuggestionItems(done: (item: Item[]) => void): void;
    select(item: Item): Transaction;
  }
  view: {
    activeClass: string;
    decorationClass: string;
    suggestionItem(item: Item): string | HTMLElement
    pending?(): string | HTMLElement;
    noResult?(): string | HTMLElement;
  }
};

export interface Match {
  range: {
    from: number,
    to: number,
  };
  queryText: string,
}