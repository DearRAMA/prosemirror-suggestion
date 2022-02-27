import { Transaction } from "prosemirror-state";

export interface SuggestionState<Item> {
  active: boolean;
  items?: Item[];
  pending: boolean;
  index: number;
  searchText?: string;
  match?: Match;
};

export interface SuggestionOption<Item> {
  match: {
    char: string,
  }

  transaction: {
    setSuggestionItems(done: (item: Item[]) => void): void;
    select(item: Item): Transaction;
  }
  view: {
    activeClass: string;
    decorationClass: string;
    suggestionItem(item: Item): string | HTMLElement
  }
};

export interface Match {
  range: {
    from: number,
    to: number,
  };
  queryText: string,
}