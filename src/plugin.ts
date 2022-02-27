import { deactive, goNext, goPrev, setIndex, setItemsAsync } from "./actions";
import { Plugin, PluginKey, Transaction } from "prosemirror-state";
import { getMatch, getPosAfterInlineNode, IsItemElement } from "./utils";
import './suggestion.css';
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { SuggestionOption, SuggestionState, SuggestionMatch } from "./interface";



function getNewState<Item>(): SuggestionState<Item> {
  return {
    active: false,
    pending: false,
    index: 0,
  };
}

function errorPendingDone<Item>(items: Item[]) {
  console.error('pendingDone');
  throw 'PendingDone';
}

class Disposable {
  public view: EditorView | null = null;
  public disposed: boolean = false;
}

export function getSuggestionPlugin<Item>(opts: SuggestionOption<Item>) {
  const pluginKey = new PluginKey('suggestion');
  let showListTimeoutId: NodeJS.Timeout | null = null;
  let _disposablePending = new Disposable();

  // const
  const HTMLCLASS_ITEM_CONTAINER = 'suggestion-item-container';
  const HTMLCLASS_ITEM_CONTAINER_ACTIVE = 'suggestion-item-container-active';

  // dropdown element
  const el = document.createElement('div');

  const plugin: Plugin<SuggestionState<Item>> = new Plugin<SuggestionState<Item>>({
    key: pluginKey,

    props: {
      handleKeyDown(view, event) {
        const pluginState = plugin.getState(view.state);

        if (!pluginState.active || !pluginState.items?.length) return false;

        switch(event.key) {
          case 'ArrowDown':
            goNext(view, view.state, plugin, opts);
            return true;
          case 'ArrowUp':
            goPrev(view, view.state, plugin, opts);
            return true;
          case 'Enter':
            opts.transaction.select(view, view.state, plugin, opts, pluginState.items?.[pluginState.index], pluginState.match as SuggestionMatch);
            return true;
          case 'Esc':
            deactive(view, view.state, plugin, opts);
            return true;
          default: 
            return false;
        }
      },

      decorations(state) {
        const { active, match } = plugin.getState(state);

        if (!active || !match) return null;
        const { range: { from, to } } = match;
        return DecorationSet.create(state.doc, [
          Decoration.inline(from, to, {
            nodeName: 'span',
            class: opts.view.decorationClass,
          })
        ])
      }
    },

    state: {
      init() {
        return getNewState();
      },

      apply(tr, value, oldState, newState) {
        
        const oldPluginState = plugin.getState(oldState);
        const meta = tr.getMeta(plugin);
        if (typeof meta?.index === 'number') {
          return {
            ...oldPluginState,
            index: meta?.index,
          }
        }
        if (meta?.deactive) {
          return {
            ...oldPluginState,
            active: false,
          }
        }
        if (meta?.setItems) {
          const items: Item[] = meta.setItems;
          return {
            ...oldPluginState,
            active: true,
            index: oldPluginState.index >= items.length ? items.length-1 : 0,
            items: items,
            pending: false,
          };
        }
        const { selection } = tr;
        if (selection.from !== selection.to) {
          return oldPluginState;
        }

        const $position = selection.$from;

        const actualFrom = getPosAfterInlineNode(tr, newState);

        const text = $position.doc.textBetween(actualFrom, $position.pos, "\n", "\0");
        if (oldPluginState.searchText === text) {
          return oldPluginState;
        }        

        const match = getMatch(text, actualFrom, selection.from, opts);

        if (!match) {
          return getNewState();
        }

        let immidiatedResult: Item[] | null = null; 
        let pending = false;
        _disposablePending.disposed = true;
        const disposablePending = new Disposable();
        opts.transaction.setSuggestionItems(match.queryText, (items) => {
          immidiatedResult = items;
          if (pending && !disposablePending.disposed) {
            const view = disposablePending.view;
            if (!view) throw 'View missing';
            setItemsAsync(view, view.state, plugin, opts, items);
          }
        });
        if (immidiatedResult) {
          const items = immidiatedResult as Item[];
          return {
            active: true,
            index: oldPluginState.index >= items.length ? items.length-1 : 0,
            items: items,
            pending: false,
            searchText: text,
            match: match,
          };
        } else {
          return {
            active: true,
            index: oldPluginState.index,
            pending: true,
            searchText: text,
            match: match,
          };
        }
      }
    },
    view() {
      return {
        update: (view, prevState) => {
          if (!_disposablePending.disposed) _disposablePending.view = view;

          const oldPluginState = plugin.getState(prevState);
          const newPluginState = plugin.getState(view.state);
          if (oldPluginState === newPluginState) {
            return;
          }
          const { active, index, pending, items, match } = newPluginState;

          if (!active) {
            el.classList['remove'](HTMLCLASS_ITEM_CONTAINER_ACTIVE);
            return;
          }

          if (!match) {
            el.classList['remove'](HTMLCLASS_ITEM_CONTAINER_ACTIVE);
            return;
          }

          const { node: element } = view.domAtPos(view.state.selection.$from.pos);
          if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

          const decorationDOM = (element as Element)?.querySelector(
            `.${opts.view.decorationClass}`
          );

          if (!decorationDOM || decorationDOM.nodeType !== Node.ELEMENT_NODE) return;
          const offset = decorationDOM.getBoundingClientRect();
          const left = `${offset.left}px`;
          const top = `${offset.bottom}px`;
          el.style.left = left;
          el.style.top = top;

          document.body.append(el);
          if (pending && !oldPluginState.pending) {
            if (!opts.view.pending) {
              el.classList['remove'](HTMLCLASS_ITEM_CONTAINER_ACTIVE);
              return;
            }
            el.innerHTML = '';
            el.append(opts.view.pending());
            el.classList['add'](HTMLCLASS_ITEM_CONTAINER_ACTIVE);
            return;
          }

          if ((!items || items.length === 0) && oldPluginState.items?.length) {
            if (!opts.view.noResult) {
              el.classList['remove'](HTMLCLASS_ITEM_CONTAINER_ACTIVE);
              return;
            }
            el.innerHTML = '';
            el.append(opts.view.noResult());
            el.classList['add'](HTMLCLASS_ITEM_CONTAINER_ACTIVE);
            return;
          }

          if (
            items && 
            oldPluginState.items !== items
          ) {
            el.innerHTML = '';
            el.classList['add'](HTMLCLASS_ITEM_CONTAINER);
            const orderedList = document.createElement('ol');
            el.append(orderedList);

            orderedList.addEventListener('click', (event) => {
              if (IsItemElement(event)) {
                opts.transaction.select(view, view.state, plugin, opts, items[index], match);
                view.focus();
              }
            });
            orderedList.addEventListener('mouseover', (event) => {
              let item;
              if (item = IsItemElement(event)) {
                const index = item.dataset['suggestionItemIndex'];
                if (typeof index === 'undefined') return;
                setIndex(view, view.state, plugin, opts, Number(index));
              }
            });
            const itemElements = items.map(item => {
              const res = opts.view.suggestionItem(item);
              const li = document.createElement('li');
              if (typeof res === 'string') {
                li.innerHTML = res;
              } else {
                li.append(res);
              }
              return li;
            });
            itemElements?.forEach((element, index) => {
              element.classList['add']('suggestion-item');
              element.setAttribute('data-suggestion-item-index', index.toString());
            });
            orderedList.append(...itemElements??[]);

            // active
            el.classList['add'](HTMLCLASS_ITEM_CONTAINER_ACTIVE);
          }
          
          // update selected ItemElement
          el.querySelectorAll(`.${opts.view.activeClass}`).forEach(element => element.classList['remove'](opts.view.activeClass));
          el.querySelector(`[data-suggestion-item-index="${index}"]`)?.classList['add'](opts.view.activeClass);

          return;
        }
      }
    }
  });
  return plugin;
}