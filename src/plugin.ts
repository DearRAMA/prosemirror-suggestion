import { goNext, goPrev, select, setIndex } from "./actions";
import { Plugin, PluginKey, Transaction } from "prosemirror-state";
import { getMatch, IsItemElement } from "./utils";
import './suggestion.css';
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { SuggestionOption, SuggestionState, Match } from "./interface";



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
            select(view, view.state, plugin, opts);
            return true;
          // case 'Esc':
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
        const initPluginState = getNewState<Item>();
        const { selection } = tr;
        if (selection.from !== selection.to) {
          return initPluginState;
        }

        const { selection: oldSelection } = oldState;
        const $position = selection.$from;

        var parastart = $position.before();
        const text = $position.doc.textBetween(parastart, $position.pos, "\n", "\0");
        if (oldPluginState.searchText === text) {
          return oldPluginState;
        }

        const match = getMatch($position, opts);

        let immidiatedResult: Item[] | null = null; 
        let pending = false;
        _disposablePending.disposed = true;
        const disposablePending = new Disposable();
        opts.transaction.setSuggestionItems((items) => {
          immidiatedResult = items;
          if (pending && !disposablePending.disposed) {
            const view = disposablePending.view;
            view?.dispatch(view?.state.tr.setMeta(plugin, { setItems: items }));
          }
        });
        if (immidiatedResult) {
          const items = immidiatedResult as Item[];
          return {
            active: true,
            index: oldPluginState.index >= items.length ? items.length-1 : 0,
            items: items,
            pending: false,
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

          if (
            !oldPluginState.items || 
            oldPluginState.items.length === 0 || 
            oldPluginState.items !== newPluginState.items
          ) {
            el.innerHTML = '<ol></ol>';
            el.classList['add']('suggestion-item-container');
            el.addEventListener('click', (event) => {
              if (IsItemElement(event)) {
                select(view, view.state, plugin, opts);
                view.focus();
              }
            });
            el.addEventListener('mouseover', (event) => {
              let item;
              if (item = IsItemElement(event)) {
                const index = item.dataset['suggestion-item-index'];
                if (index === undefined) return;
                setIndex(view, view.state, plugin, opts, Number(index));
              }
            })
            const itemElements = newPluginState.items?.map(item => {
              const res = opts.view.suggestionItem(item);
              if (typeof res === 'string') {
                const template = document.createElement('template');
                template.innerHTML = res;
                return template;
              } else {
                return res;
              }
            });
            itemElements?.forEach((element, index) => {
              element.classList['add']('suggestion-item');
              element.dataset['suggestion-item-index'] = index.toString();
            });
            el.append(...itemElements??[]);
          }
          
          // active
          el.classList['add']('suggestion-item-container-active');

          // update selected ItemElement
          el.querySelectorAll(`.${opts.view.activeClass}`).forEach(element => element.classList['remove'](opts.view.activeClass));
          el.querySelector(`[data-suggestion-item-index="${newPluginState.index}"]`)?.classList['add'](opts.view.activeClass);

          const { node: element } = view.domAtPos(view.state.selection.$from.pos);
          if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

          const decorationDOM = (element as Element)?.querySelector(
            `.${opts.view.decorationClass}`
          );

          if (!decorationDOM || decorationDOM.nodeType !== Node.ELEMENT_NODE) return;
          const offset = decorationDOM.getBoundingClientRect();
          el.style.left = `${offset.left}px`;
          el.style.top = `${offset.bottom}px`;

        }
      }
    }
  });
}