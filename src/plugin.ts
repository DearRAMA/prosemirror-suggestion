import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { deactive, goNext, goPrev, setIndex, setItemsAsync } from "./actions";
import { HTMLCLASS_ACTIVE, HTMLCLASS_DECORATION, HTMLCLASS_ITEM, HTMLCLASS_ITEM_CONTAINER, HTMLCLASS_ITEM_CONTAINER_ACTIVE, HTMLDATASET_INDEX_CAMEL, HTMLDATASET_INDEX_HYPHEN, PLUGINKEY_PREFIX } from './constant';
import { SuggestionOption, SuggestionState, SuggestionMatch } from "./interface";
import { getMatch, getPosAfterInlineNode, isItemElement } from "./utils";
import './suggestion.css';


function getNewState<Item>(): SuggestionState<Item> {
  return {
    active: false,
    pending: false,
    index: 0,
  };
}

class Disposable {
  public view: EditorView | null = null;
  public disposed: boolean = false;
}

export function getSuggestionPlugin<Item>(opts: SuggestionOption<Item>) {
  const key = `${PLUGINKEY_PREFIX}${opts.key ?? Math.random().toString(36).slice(2,10)}`
  const pluginKey = new PluginKey(key);
  let _disposablePending = new Disposable();

  // dropdown element
  const el = document.createElement('div');
  el.classList['add'](HTMLCLASS_ITEM_CONTAINER);

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
            class: HTMLCLASS_DECORATION,
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
        _disposablePending = disposablePending;
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
          pending = true;
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
            `.${HTMLCLASS_DECORATION}`
          );

          if (!decorationDOM || decorationDOM.nodeType !== Node.ELEMENT_NODE) return;
          const offset = decorationDOM.getBoundingClientRect();
          const left = (!opts.view.listPosition || opts.view.listPosition === 'start') ?
            `${offset.left}px` : `${offset.right}px`;
          const top = `${offset.bottom}px`;
          el.style.left = left;
          el.style.top = top;

          document.body.append(el);
          if (pending) {
            if (!opts.view.pending) {
              el.classList['remove'](HTMLCLASS_ITEM_CONTAINER_ACTIVE);
              return;
            }
            el.innerHTML = '';
            el.append(opts.view.pending());
            el.classList['add'](HTMLCLASS_ITEM_CONTAINER_ACTIVE);
            return;
          }

          if ((!items || items.length === 0)) {
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
            const orderedList = document.createElement('ol');
            el.append(orderedList);

            orderedList.addEventListener('click', (event) => {
              let item;
              if (item = isItemElement(event)) {
                const index = item.dataset[HTMLDATASET_INDEX_CAMEL];
                if (typeof index === 'undefined') return;
                // RPRS-18 In mobile click fired without mouseover. so get index irrespective of state
                setIndex(view, view.state, plugin, opts, Number(index));
                opts.transaction.select(view, view.state, plugin, opts, items[Number(index)], match);
                view.focus();
              }
            });
            orderedList.addEventListener('mouseover', (event) => {
              let item;
              if (item = isItemElement(event)) {
                const index = item.dataset[HTMLDATASET_INDEX_CAMEL];
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
              element.classList['add'](HTMLCLASS_ITEM);
              element.setAttribute(HTMLDATASET_INDEX_HYPHEN, index.toString());
            });
            orderedList.append(...itemElements??[]);

            // active
            el.classList['add'](HTMLCLASS_ITEM_CONTAINER_ACTIVE);
          }
          
          // update selected ItemElement
          el.querySelectorAll(`.${HTMLCLASS_ITEM}.${HTMLCLASS_ACTIVE}`).forEach(element => element.classList['remove'](HTMLCLASS_ACTIVE));
          el.querySelector(`[${HTMLDATASET_INDEX_HYPHEN}="${index}"]`)?.classList['add'](HTMLCLASS_ACTIVE);

          return;
        }
      }
    }
  });
  return plugin;
}