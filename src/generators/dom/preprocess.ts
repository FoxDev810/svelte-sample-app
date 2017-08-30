import Block from './Block';
import { trimStart, trimEnd } from '../../utils/trim';
import { assign } from '../../shared/index.js';
import getStaticAttributeValue from '../shared/getStaticAttributeValue';
import { DomGenerator } from './index';
import { Node } from '../../interfaces';
import { State } from './interfaces';

function isElseIf(node: Node) {
	return (
		node && node.children.length === 1 && node.children[0].type === 'IfBlock'
	);
}

function getChildState(parent: State, child = {}) {
	return assign(
		{},
		parent,
		{ name: null, parentNode: null, parentNodes: 'nodes' },
		child || {}
	);
}

// Whitespace inside one of these elements will not result in
// a whitespace node being created in any circumstances. (This
// list is almost certainly very incomplete)
const elementsWithoutText = new Set([
	'audio',
	'datalist',
	'dl',
	'ol',
	'optgroup',
	'select',
	'ul',
	'video',
]);

const preprocessors = {
	MustacheTag: (
		generator: DomGenerator,
		block: Block,
		state: State,
		node: Node,
		elementStack: Node[],
		componentStack: Node[],
		stripWhitespace: boolean
	) => {
		const dependencies = block.findDependencies(node.expression);
		block.addDependencies(dependencies);

		node._state = getChildState(state, {
			name: block.getUniqueName('text'),
		});
	},

	RawMustacheTag: (
		generator: DomGenerator,
		block: Block,
		state: State,
		node: Node,
		elementStack: Node[],
		componentStack: Node[],
		stripWhitespace: boolean
	) => {
		const dependencies = block.findDependencies(node.expression);
		block.addDependencies(dependencies);

		const name = block.getUniqueName('raw');
		node._state = getChildState(state, { name });
	},

	Text: (
		generator: DomGenerator,
		block: Block,
		state: State,
		node: Node,
		elementStack: Node[],
		componentStack: Node[],
		stripWhitespace: boolean
	) => {
		node._state = getChildState(state);

		if (!/\S/.test(node.data)) {
			if (state.namespace) return;
			if (elementsWithoutText.has(state.parentNodeName)) return;
		}

		node._state.shouldCreate = true;
		node._state.name = block.getUniqueName(`text`);
	},

	IfBlock: (
		generator: DomGenerator,
		block: Block,
		state: State,
		node: Node,
		inEachBlock: boolean,
		elementStack: Node[],
		componentStack: Node[],
		stripWhitespace: boolean,
		nextSibling: Node
	) => {
		const blocks: Block[] = [];
		let dynamic = false;
		let hasIntros = false;
		let hasOutros = false;

		function attachBlocks(node: Node) {
			const dependencies = block.findDependencies(node.expression);
			block.addDependencies(dependencies);

			node._block = block.child({
				name: generator.getUniqueName(`create_if_block`),
			});

			node._state = getChildState(state);

			blocks.push(node._block);
			preprocessChildren(generator, node._block, node._state, node, inEachBlock, elementStack, componentStack, stripWhitespace, nextSibling);

			if (node._block.dependencies.size > 0) {
				dynamic = true;
				block.addDependencies(node._block.dependencies);
			}

			if (node._block.hasIntroMethod) hasIntros = true;
			if (node._block.hasOutroMethod) hasOutros = true;

			if (isElseIf(node.else)) {
				attachBlocks(node.else.children[0]);
			} else if (node.else) {
				node.else._block = block.child({
					name: generator.getUniqueName(`create_if_block`),
				});

				node.else._state = getChildState(state);

				blocks.push(node.else._block);
				preprocessChildren(
					generator,
					node.else._block,
					node.else._state,
					node.else,
					inEachBlock,
					elementStack,
					componentStack,
					stripWhitespace,
					nextSibling
				);

				if (node.else._block.dependencies.size > 0) {
					dynamic = true;
					block.addDependencies(node.else._block.dependencies);
				}
			}
		}

		attachBlocks(node);

		blocks.forEach(block => {
			block.hasUpdateMethod = dynamic;
			block.hasIntroMethod = hasIntros;
			block.hasOutroMethod = hasOutros;
		});

		generator.blocks.push(...blocks);
	},

	EachBlock: (
		generator: DomGenerator,
		block: Block,
		state: State,
		node: Node,
		inEachBlock: boolean,
		elementStack: Node[],
		componentStack: Node[],
		stripWhitespace: boolean,
		nextSibling: Node
	) => {
		const dependencies = block.findDependencies(node.expression);
		block.addDependencies(dependencies);

		const indexNames = new Map(block.indexNames);
		const indexName =
			node.index || block.getUniqueName(`${node.context}_index`);
		indexNames.set(node.context, indexName);

		const listNames = new Map(block.listNames);
		const listName = block.getUniqueName(`each_block_value`);
		listNames.set(node.context, listName);

		const context = generator.getUniqueName(node.context);
		const contexts = new Map(block.contexts);
		contexts.set(node.context, context);

		const indexes = new Map(block.indexes);
		if (node.index) indexes.set(node.index, node.context);

		const changeableIndexes = new Map(block.changeableIndexes);
		if (node.index) changeableIndexes.set(node.index, node.key);

		const contextDependencies = new Map(block.contextDependencies);
		contextDependencies.set(node.context, dependencies);

		node._block = block.child({
			name: generator.getUniqueName('create_each_block'),
			expression: node.expression,
			context: node.context,
			key: node.key,

			contextDependencies,
			contexts,
			indexes,
			changeableIndexes,

			listName,
			indexName,

			indexNames,
			listNames,
			params: block.params.concat(listName, context, indexName),
		});

		node._state = getChildState(state, {
			inEachBlock: true,
		});

		generator.blocks.push(node._block);
		preprocessChildren(generator, node._block, node._state, node, true, elementStack, componentStack, stripWhitespace, nextSibling);
		block.addDependencies(node._block.dependencies);
		node._block.hasUpdateMethod = node._block.dependencies.size > 0;

		if (node.else) {
			node.else._block = block.child({
				name: generator.getUniqueName(`${node._block.name}_else`),
			});

			node.else._state = getChildState(state);

			generator.blocks.push(node.else._block);
			preprocessChildren(
				generator,
				node.else._block,
				node.else._state,
				node.else,
				inEachBlock,
				elementStack,
				componentStack,
				stripWhitespace,
				nextSibling
			);
			node.else._block.hasUpdateMethod = node.else._block.dependencies.size > 0;
		}
	},

	Element: (
		generator: DomGenerator,
		block: Block,
		state: State,
		node: Node,
		inEachBlock: boolean,
		elementStack: Node[],
		componentStack: Node[],
		stripWhitespace: boolean,
		nextSibling: Node
	) => {
		node.attributes.forEach((attribute: Node) => {
			if (attribute.type === 'Attribute' && attribute.value !== true) {
				attribute.value.forEach((chunk: Node) => {
					if (chunk.type !== 'Text') {
						const dependencies = block.findDependencies(chunk.expression);
						block.addDependencies(dependencies);

						// special case — <option value='{{foo}}'> — see below
						if (
							node.name === 'option' &&
							attribute.name === 'value' &&
							state.selectBindingDependencies
						) {
							state.selectBindingDependencies.forEach(prop => {
								dependencies.forEach((dependency: string) => {
									generator.indirectDependencies.get(prop).add(dependency);
								});
							});
						}
					}
				});
			} else if (attribute.type === 'EventHandler' && attribute.expression) {
				attribute.expression.arguments.forEach((arg: Node) => {
					const dependencies = block.findDependencies(arg);
					block.addDependencies(dependencies);
				});
			} else if (attribute.type === 'Binding') {
				const dependencies = block.findDependencies(attribute.value);
				block.addDependencies(dependencies);
			} else if (attribute.type === 'Transition') {
				if (attribute.intro)
					generator.hasIntroTransitions = block.hasIntroMethod = true;
				if (attribute.outro) {
					generator.hasOutroTransitions = block.hasOutroMethod = true;
					block.outros += 1;
				}
			}
		});

		// special case — in a case like this...
		//
		//   <select bind:value='foo'>
		//     <option value='{{bar}}'>bar</option>
		//     <option value='{{baz}}'>baz</option>
		//   </option>
		//
		// ...we need to know that `foo` depends on `bar` and `baz`,
		// so that if `foo.qux` changes, we know that we need to
		// mark `bar` and `baz` as dirty too
		if (node.name === 'select') {
			const value = node.attributes.find(
				(attribute: Node) => attribute.name === 'value'
			);
			if (value) {
				// TODO does this also apply to e.g. `<input type='checkbox' bind:group='foo'>`?
				const dependencies = block.findDependencies(value.value);
				state.selectBindingDependencies = dependencies;
				dependencies.forEach((prop: string) => {
					generator.indirectDependencies.set(prop, new Set());
				});
			} else {
				state.selectBindingDependencies = null;
			}
		}

		const isComponent =
			generator.components.has(node.name) || node.name === ':Self';

		if (isComponent) {
			const name = block.getUniqueName(
				(node.name === ':Self' ? generator.name : node.name).toLowerCase()
			);

			node._state = getChildState(state, {
				name,
				parentNode: `${name}._slotted.default`
			});
		} else {
			const slot = getStaticAttributeValue(node, 'slot');
			if (slot) {
				// TODO validate slots — no nesting, no dynamic names...
				const component = componentStack[componentStack.length - 1];
				component._slots.add(slot);
			}

			const name = block.getUniqueName(
				node.name.replace(/[^a-zA-Z0-9_$]/g, '_')
			);

			node._state = getChildState(state, {
				isTopLevel: false,
				name,
				parentNode: name,
				parentNodes: block.getUniqueName(`${name}_nodes`),
				parentNodeName: node.name,
				namespace: node.name === 'svg'
					? 'http://www.w3.org/2000/svg'
					: state.namespace,
				allUsedContexts: [],
			});

			generator.stylesheet.apply(node, elementStack);
		}

		if (node.children.length) {
			if (isComponent) {
				if (node.children) node._slots = new Set(['default']);
				preprocessChildren(generator, block, node._state, node, inEachBlock, elementStack, componentStack.concat(node), stripWhitespace, nextSibling);
			} else {
				if (node.name === 'pre' || node.name === 'textarea') stripWhitespace = false;
				preprocessChildren(generator, block, node._state, node, inEachBlock, elementStack.concat(node), componentStack, stripWhitespace, nextSibling);
			}
		}
	},
};

function preprocessChildren(
	generator: DomGenerator,
	block: Block,
	state: State,
	node: Node,
	inEachBlock: boolean,
	elementStack: Node[],
	componentStack: Node[],
	stripWhitespace: boolean,
	nextSibling: Node
) {
	// glue text nodes together
	const cleaned: Node[] = [];
	let lastChild: Node;

	node.children.forEach((child: Node) => {
		if (child.type === 'Comment') return;

		if (child.type === 'Text' && lastChild && lastChild.type === 'Text') {
			lastChild.data += child.data;
			lastChild.end = child.end;
		} else {
			if (child.type === 'Text' && stripWhitespace && cleaned.length === 0) {
				child.data = trimStart(child.data);
				if (child.data) cleaned.push(child);
			} else {
				cleaned.push(child);
			}
		}

		lastChild = child;
	});

	lastChild = null;

	cleaned.forEach((child: Node, i: number) => {
		const preprocessor = preprocessors[child.type];
		if (preprocessor) preprocessor(generator, block, state, child, inEachBlock, elementStack, componentStack, stripWhitespace, cleaned[i + 1] || nextSibling);

		if (lastChild) lastChild.next = child;
		child.prev = lastChild;

		lastChild = child;
	});

	// We want to remove trailing whitespace inside an element/component/block,
	// *unless* there is no whitespace between this node and its next sibling
	if (stripWhitespace && lastChild && lastChild.type === 'Text') {
		const shouldTrim = (
			nextSibling ?  (nextSibling.type === 'Text' && /^\s/.test(nextSibling.data)) : !inEachBlock
		);

		if (shouldTrim) {
			lastChild.data = trimEnd(lastChild.data);
			if (!lastChild.data) {
				cleaned.pop();
				lastChild = cleaned[cleaned.length - 1];
				lastChild.next = null;
			}
		}
	}

	node.children = cleaned;
}

export default function preprocess(
	generator: DomGenerator,
	namespace: string,
	node: Node
) {
	const block = new Block({
		generator,
		name: '@create_main_fragment',
		key: null,

		contexts: new Map(),
		indexes: new Map(),
		changeableIndexes: new Map(),
		contextDependencies: new Map(),

		params: ['state'],
		indexNames: new Map(),
		listNames: new Map(),

		dependencies: new Set(),
	});

	const state: State = {
		namespace,
		parentNode: null,
		parentNodes: 'nodes',
		isTopLevel: true,
	};

	generator.blocks.push(block);
	preprocessChildren(generator, block, state, node, false, [], [], true, null);
	block.hasUpdateMethod = true;

	return { block, state };
}
