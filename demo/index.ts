/* eslint-disable import/no-extraneous-dependencies */
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { DOMParser, NodeSpec, Schema, Node, NodeType } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { exampleSetup } from 'prosemirror-example-setup';
import OrderedMap from "orderedmap";

import { FlavorNode } from './sampleNode';
import { createHTMLTransformer, createJSONTransformer, createNullTransformer } from "@aeaton/prosemirror-transformers";
import { getNodemarkPlugin } from "@dear-rama/prosemirror-nodemark";
import '@dear-rama/prosemirror-nodemark/dist/nodemark.css';
import { isActive } from '@dear-rama/prosemirror-nodemark/dist/utils';


const editor = document.querySelector('#editor') as HTMLDivElement;
const content = document.querySelector('#content') as HTMLDivElement;

export const schema = new Schema({
  marks: basicSchema.spec.marks,
  nodes: (basicSchema.spec.nodes as OrderedMap<NodeSpec>).append({flavor: FlavorNode})
});

const htmlTransformer = createHTMLTransformer(schema);
const htmlResult = document.querySelector('#html-result') as HTMLDivElement;
const pluginState = document.querySelector('#plugin-state') as HTMLDivElement;

function posView(html: string, selection: number) {
  let index = 0;
  let pos = 0;


  let result = posFormat(pos, pos===selection); pos++;
  
  
  while (index < html.length)  {
    if (html[index] === "<") {
      const end = html.indexOf('>', index);
      const nodeType = html.slice(index+1, end);
      result += `&lt;${nodeType}&gt;`;
      index = end+1;
      if (nodeType === 'code' || nodeType === '/code') continue;
    } else {
      result += html[index];
      index++;
    }
    result += posFormat(pos, pos===selection); pos++;
  }
  return result;
}

function posFormat(pos: number, strong = false) {
  if (strong) return `<ruby>&#8203;<rt><b style="color: red;">${pos++}</b></rt></ruby>`
  else return `<ruby>&#8203;<rt>${pos++}</rt></ruby>`
}

const plugin = getNodemarkPlugin({nodeType: schema.nodes['flavor']});
(window as any).view = new EditorView(editor, {
  state: EditorState.create({
    doc: DOMParser.fromSchema(schema).parse(content),
    plugins: [
      plugin,
      ...exampleSetup({ schema, menuBar: false }),
    ],
  }),
  dispatchTransaction(tr) {
    const state = this.state.apply(tr);
    this.updateState(state);
    htmlResult.innerHTML = posView(htmlTransformer.serialize(state.doc), state.selection.from);
    pluginState.innerText = `active ${isActive(state, state.schema.nodes.flavor)} state ${JSON.stringify(plugin.getState(state))}`;
  }
});

// This is showing what not to do!!
const editor1 = document.querySelector('#editor1') as HTMLDivElement;
const content1 = document.querySelector('#content1') as HTMLDivElement;
(window as any).view1 = new EditorView(editor1, {
  state: EditorState.create({
    doc: DOMParser.fromSchema(schema).parse(content1),
    plugins: [...exampleSetup({ schema, menuBar: false })],
  }),
});
