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
import { InputRule, inputRules } from 'prosemirror-inputrules';
import { getMatch, getPosAfterInlineNode } from '../src/utils';


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
      inputRules({
        rules: [
          new InputRule(
            /\/(.+)\//,
            (state, match, start, end) => {
              console.log(match);
              console.log(`${start}, ${end}`)
              return state.tr.delete(start, end).insert(start, schema.node('flavor', {code: 'test', name: 'test'}, schema.text(match[1])));
            }
          )
        ]
      }),
      ...exampleSetup({ schema, menuBar: false }),
    ],
  }),
  dispatchTransaction(tr) {
    const state = this.state.apply(tr);
    this.updateState(state);
    htmlResult.innerHTML = posView(htmlTransformer.serialize(state.doc), state.selection.from);
    pluginState.innerText = `active ${isActive(state, state.schema.nodes.flavor)} state ${JSON.stringify(plugin.getState(state))}`;
    const actualFrom = getPosAfterInlineNode(tr, state);
    const text = tr.selection.$from.doc.textBetween(actualFrom, tr.selection.from, "\n", "\0");
    const range = getMatch(text, actualFrom, tr.selection.from, { match:{ char:':', allowSpace: true, allowPrefixChar: true } });
    console.log('getMatch', JSON.stringify(range));
  }
});