import { Node as PMNode } from "prosemirror-model";
import { EditorState, Transaction } from "prosemirror-state";
import { SuggestionMatch, SuggestionOption, SuggestionMatcher } from "./interface";


export function isItemElement(event: MouseEvent): false | HTMLElement {
  if (!(event.target instanceof HTMLElement)) return false;

  const child = event.target.closest('.suggestion-item');
  if (child instanceof HTMLElement) {
    return child;
  } else {
    return false;
  }
}

export function changeRegexSpecialCharactor(char: string) {
  const specialCharactors = '\\^$*+?.()|{}';
  if (specialCharactors.indexOf(char) !== -1) return `\\${char}`;
  else return char; 
}

class DefaultSuggestionRegexpMatch<Item = any> {
  regexp: RegExp;
  allowPrefixChar: boolean;
  char: string;

  constructor(opts: Pick<SuggestionOption<Item>, 'match'>) {
    const { match: {
      char,
      allowSpace = false,
      allowPrefixChar = false,
    }} = opts;
    this.allowPrefixChar = allowPrefixChar;
    this.char = char;
    
    this.regexp = new RegExp(
      (allowPrefixChar ? '' : '(^|\\s)') +
      changeRegexSpecialCharactor(char) +
      (allowSpace ? 
        "((?:\\p{L}|[-_\\+]|\\s)*)$" :
        '((?:\\p{L}|[-_\\+])*)$'),
      "u"
    );
  }

  valid: boolean = false;
  query: string = '';
  index: number = 0;
  length: number = 0;

  exec(text: string) {
    const match = text.match(this.regexp);
    if (!match || typeof match.index === 'undefined') {
      this.valid = false;
      return;
    };
    this.valid = true;
    this.query = match[this.allowPrefixChar ? 1 : 2];
    this.index = (match.index as number)+ (this.allowPrefixChar ? 0 : match[1].length);
    this.length = this.char.length + (this.allowPrefixChar ? match[1].length : match[2].length);
  }
}

export function getRegex<Item>(opts: Pick<SuggestionOption<Item>, 'match'>): SuggestionMatcher {
  const { match: {
    char,
    allowSpace = false,
    allowPrefixChar = false,
  }} = opts;

  const match = {
    regexp: new RegExp(
      (allowPrefixChar ? '' : '(^|\\s)') +
      changeRegexSpecialCharactor(char) +
      (allowSpace ? 
        "((?:\\p{L}|[-_\\+]|\\s)*)$" :
        '((?:\\p{L}|[-_\\+])*)$'),
      "u"
    ),
    valid: false,
    query: '',
    index: 0,
    length: 0,
    exec(text: string) {
      const match = text.match(this.regexp);
      if (!match || typeof match.index === 'undefined') {
        this.valid = false;
        return;
      };
      this.valid = true;
      this.query = match[allowPrefixChar ? 1 : 2];
      this.index = (match.index as number)+ (allowPrefixChar ? 0 : match[1].length);
      this.length = char.length + (allowPrefixChar ? match[1].length : match[2].length);
    }
  }

  return match;
}

export function getMatch<Item>(text: string, from: number, to: number, opts: Pick<SuggestionOption<Item>, 'match'>): SuggestionMatch | null {
  const suggestionMatcher = getRegex(opts);

  suggestionMatcher.exec(text);

  if (!suggestionMatcher.valid) return null;

  return {
    queryText: suggestionMatcher.query,
    range: {
      from : from + suggestionMatcher.index,
      to: from + suggestionMatcher.index + suggestionMatcher.length,
    }
  };
}

export function getPosAfterInlineNode(tr: Transaction, state: EditorState) {
  const { $from } = tr.selection;
  const from = $from.before($from.depth);
  const to = tr.selection.from;
  let root: PMNode;
  let last = from;
  state.selection.$from.doc.nodesBetween(from, to, (node, pos, parent, index) => {
    console.debug('suggestion', 'getPosAfterInlineNode', from, to, `node ${JSON.stringify(node)}, pos ${pos}, parent ${parent}, index ${index}`);

    if (!root) {
      root = node;
      last = Math.max(last, pos+1);
      return;
    }
    if (node.type === state.schema.nodes.text) return;

    console.debug('suggestion', 'getPosAfterInlineNode', `pos + node.nodeSize ${pos + node.nodeSize}`);
    last = Math.max(last, pos + node.nodeSize);
  });
  console.debug('suggestion', 'getPosAfterInlineNode', `last ${last}`);
  return last;
}