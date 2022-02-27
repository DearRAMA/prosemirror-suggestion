import { SuggestionOption, SuggestionState } from "./interface";
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

export function setIndex<Item>(view: EditorView, state: EditorState, plugin: Plugin<SuggestionState<Item>>, opts: SuggestionOption<Item>, index: number) {
  view.dispatch(view.state.tr.setMeta(plugin, { index: index }));
}

export function goNext<Item>(view: EditorView, state: EditorState, plugin: Plugin<SuggestionState<Item>>, opts: SuggestionOption<Item>) {
  const { index, items } = plugin.getState(state);
  const next = (!items || index+1 >= items.length) ? 0 : index+1;
  setIndex(view, state, plugin, opts, next);
}

export function goPrev<Item>(view: EditorView, state: EditorState, plugin: Plugin<SuggestionState<Item>>, opts: SuggestionOption<Item>) {
  const { index, items } = plugin.getState(state);
  const prev = items ? (index-1 < 0 ? items.length-1 : index-1) : 0;
  setIndex(view, state, plugin, opts, prev);
}

export function setItemsAsync<Item>(view: EditorView, state: EditorState, plugin: Plugin<SuggestionState<Item>>, opts: SuggestionOption<Item>, items: Item[]) {
  view?.dispatch(view?.state.tr.setMeta(plugin, { setItems: items }));
}

export function deactive<Item>(view: EditorView, state: EditorState, plugin: Plugin<SuggestionState<Item>>, opts: SuggestionOption<Item>) {
  view.dispatch(view.state.tr.setMeta(plugin, { deactive: true }));
}