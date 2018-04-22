import deindent from '../../utils/deindent';
import { stringify } from '../../utils/stringify';
import fixAttributeCasing from '../../utils/fixAttributeCasing';
import getExpressionPrecedence from '../../utils/getExpressionPrecedence';
import { DomGenerator } from '../dom/index';
import Node from './shared/Node';
import Element from './Element';
import Block from '../dom/Block';

export interface StyleProp {
	key: string;
	value: Node[];
}

export default class Attribute extends Node {
	type: 'Attribute';
	start: number;
	end: number;

	compiler: DomGenerator;
	parent: Element;
	name: string;
	value: true | Node[]
	expression: Node;

	constructor(compiler, parent, info) {
		super(compiler, parent, info);

		this.name = info.name;
		this.value = info.value;
	}

	render(block: Block) {
		const node = this.parent;
		const name = fixAttributeCasing(this.name);

		if (name === 'style') {
			const styleProps = optimizeStyle(this.value);
			if (styleProps) {
				this.renderStyle(block, styleProps);
				return;
			}
		}

		let metadata = node.namespace ? null : attributeLookup[name];
		if (metadata && metadata.appliesTo && !~metadata.appliesTo.indexOf(node.name))
			metadata = null;

		const isIndirectlyBoundValue =
			name === 'value' &&
			(node.name === 'option' || // TODO check it's actually bound
				(node.name === 'input' &&
					node.attributes.find(
						(attribute: Attribute) =>
							attribute.type === 'Binding' && /checked|group/.test(attribute.name)
						)));

		const propertyName = isIndirectlyBoundValue
			? '__value'
			: metadata && metadata.propertyName;

		// xlink is a special case... we could maybe extend this to generic
		// namespaced attributes but I'm not sure that's applicable in
		// HTML5?
		const method = name.slice(0, 6) === 'xlink:'
			? '@setXlinkAttribute'
			: '@setAttribute';

		const isDynamic = this.isDynamic();
		const isLegacyInputType = this.generator.legacy && name === 'type' && this.parent.name === 'input';

		const isDataSet = /^data-/.test(name) && !this.generator.legacy && !node.namespace;
		const camelCaseName = isDataSet ? name.replace('data-', '').replace(/(-\w)/g, function (m) {
			return m[1].toUpperCase();
		}) : name;

		if (isDynamic) {
			let value;

			const allDependencies = new Set();
			let shouldCache;
			let hasChangeableIndex;

			// TODO some of this code is repeated in Tag.ts — would be good to
			// DRY it out if that's possible without introducing crazy indirection
			if (this.value.length === 1) {
				// single {{tag}} — may be a non-string
				const { expression } = this.value[0];
				const { indexes } = block.contextualise(expression);
				const { dependencies, snippet } = this.value[0].metadata;

				value = snippet;
				dependencies.forEach(d => {
					allDependencies.add(d);
				});

				hasChangeableIndex = Array.from(indexes).some(index => block.changeableIndexes.get(index));

				shouldCache = (
					expression.type !== 'Identifier' ||
					block.contexts.has(expression.name) ||
					hasChangeableIndex
				);
			} else {
				// '{{foo}} {{bar}}' — treat as string concatenation
				value =
					(this.value[0].type === 'Text' ? '' : `"" + `) +
					this.value
						.map((chunk: Node) => {
							if (chunk.type === 'Text') {
								return stringify(chunk.data);
							} else {
								const { indexes } = block.contextualise(chunk.expression);
								const { dependencies, snippet } = chunk.metadata;

								if (Array.from(indexes).some(index => block.changeableIndexes.get(index))) {
									hasChangeableIndex = true;
								}

								dependencies.forEach(d => {
									allDependencies.add(d);
								});

								return getExpressionPrecedence(chunk.expression) <= 13 ? `(${snippet})` : snippet;
							}
						})
						.join(' + ');

				shouldCache = true;
			}

			const isSelectValueAttribute =
				name === 'value' && node.name === 'select';

			const last = (shouldCache || isSelectValueAttribute) && block.getUniqueName(
				`${node.var}_${name.replace(/[^a-zA-Z_$]/g, '_')}_value`
			);

			if (shouldCache || isSelectValueAttribute) block.addVariable(last);

			let updater;
			const init = shouldCache ? `${last} = ${value}` : value;

			if (isLegacyInputType) {
				block.builders.hydrate.addLine(
					`@setInputType(${node.var}, ${init});`
				);
				updater = `@setInputType(${node.var}, ${shouldCache ? last : value});`;
			} else if (isSelectValueAttribute) {
				// annoying special case
				const isMultipleSelect = node.getStaticAttributeValue('multiple');
				const i = block.getUniqueName('i');
				const option = block.getUniqueName('option');

				const ifStatement = isMultipleSelect
					? deindent`
						${option}.selected = ~${last}.indexOf(${option}.__value);`
					: deindent`
						if (${option}.__value === ${last}) {
							${option}.selected = true;
							break;
						}`;

				updater = deindent`
					for (var ${i} = 0; ${i} < ${node.var}.options.length; ${i} += 1) {
						var ${option} = ${node.var}.options[${i}];

						${ifStatement}
					}
				`;

				block.builders.hydrate.addBlock(deindent`
					${last} = ${value};
					${updater}
				`);

				block.builders.update.addLine(`${last} = ${value};`);
			} else if (propertyName) {
				block.builders.hydrate.addLine(
					`${node.var}.${propertyName} = ${init};`
				);
				updater = `${node.var}.${propertyName} = ${shouldCache ? last : value};`;
			} else if (isDataSet) {
				block.builders.hydrate.addLine(
					`${node.var}.dataset.${camelCaseName} = ${init};`
				);
				updater = `${node.var}.dataset.${camelCaseName} = ${shouldCache ? last : value};`;
			} else {
				block.builders.hydrate.addLine(
					`${method}(${node.var}, "${name}", ${init});`
				);
				updater = `${method}(${node.var}, "${name}", ${shouldCache ? last : value});`;
			}

			if (allDependencies.size || hasChangeableIndex || isSelectValueAttribute) {
				const dependencies = Array.from(allDependencies);
				const changedCheck = (
					( block.hasOutroMethod ? `#outroing || ` : '' ) +
					dependencies.map(dependency => `changed.${dependency}`).join(' || ')
				);

				const updateCachedValue = `${last} !== (${last} = ${value})`;

				const condition = shouldCache ?
					( dependencies.length ? `(${changedCheck}) && ${updateCachedValue}` : updateCachedValue ) :
					changedCheck;

				block.builders.update.addConditional(
					condition,
					updater
				);
			}
		} else {
			const value = this.value === true
				? 'true'
				: this.value.length === 0 ? `""` : stringify(this.value[0].data);

			const statement = (
				isLegacyInputType
					? `@setInputType(${node.var}, ${value});`
					: propertyName
						? `${node.var}.${propertyName} = ${value};`
						: isDataSet
							? `${node.var}.dataset.${camelCaseName} = ${value};`
							: `${method}(${node.var}, "${name}", ${value});`
			);

			block.builders.hydrate.addLine(statement);

			// special case – autofocus. has to be handled in a bit of a weird way
			if (this.value === true && name === 'autofocus') {
				block.autofocus = node.var;
			}
		}

		if (isIndirectlyBoundValue) {
			const updateValue = `${node.var}.value = ${node.var}.__value;`;

			block.builders.hydrate.addLine(updateValue);
			if (isDynamic) block.builders.update.addLine(updateValue);
		}
	}

	renderStyle(
		block: Block,
		styleProps: StyleProp[]
	) {
		styleProps.forEach((prop: StyleProp) => {
			let value;

			if (isDynamic(prop.value)) {
				const allDependencies = new Set();
				let shouldCache;
				let hasChangeableIndex;

				value =
					((prop.value.length === 1 || prop.value[0].type === 'Text') ? '' : `"" + `) +
					prop.value
						.map((chunk: Node) => {
							if (chunk.type === 'Text') {
								return stringify(chunk.data);
							} else {
								const { indexes } = block.contextualise(chunk.expression);
								const { dependencies, snippet } = chunk.metadata;

								if (Array.from(indexes).some(index => block.changeableIndexes.get(index))) {
									hasChangeableIndex = true;
								}

								dependencies.forEach(d => {
									allDependencies.add(d);
								});

								return getExpressionPrecedence(chunk.expression) <= 13 ? `( ${snippet} )` : snippet;
							}
						})
						.join(' + ');

				if (allDependencies.size || hasChangeableIndex) {
					const dependencies = Array.from(allDependencies);
					const condition = (
						( block.hasOutroMethod ? `#outroing || ` : '' ) +
						dependencies.map(dependency => `changed.${dependency}`).join(' || ')
					);

					block.builders.update.addConditional(
						condition,
						`@setStyle(${this.parent.var}, "${prop.key}", ${value});`
					);
				}
			} else {
				value = stringify(prop.value[0].data);
			}

			block.builders.hydrate.addLine(
				`@setStyle(${this.parent.var}, "${prop.key}", ${value});`
			);
		});
	}

	isDynamic() {
		if (this.value === true || this.value.length === 0) return false;
		if (this.value.length > 1) return true;
		return this.value[0].type !== 'Text';
	}
}

// source: https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
const attributeLookup = {
	accept: { appliesTo: ['form', 'input'] },
	'accept-charset': { propertyName: 'acceptCharset', appliesTo: ['form'] },
	accesskey: { propertyName: 'accessKey' },
	action: { appliesTo: ['form'] },
	align: {
		appliesTo: [
			'applet',
			'caption',
			'col',
			'colgroup',
			'hr',
			'iframe',
			'img',
			'table',
			'tbody',
			'td',
			'tfoot',
			'th',
			'thead',
			'tr',
		],
	},
	allowfullscreen: { propertyName: 'allowFullscreen', appliesTo: ['iframe'] },
	alt: { appliesTo: ['applet', 'area', 'img', 'input'] },
	async: { appliesTo: ['script'] },
	autocomplete: { appliesTo: ['form', 'input'] },
	autofocus: { appliesTo: ['button', 'input', 'keygen', 'select', 'textarea'] },
	autoplay: { appliesTo: ['audio', 'video'] },
	autosave: { appliesTo: ['input'] },
	bgcolor: {
		propertyName: 'bgColor',
		appliesTo: [
			'body',
			'col',
			'colgroup',
			'marquee',
			'table',
			'tbody',
			'tfoot',
			'td',
			'th',
			'tr',
		],
	},
	border: { appliesTo: ['img', 'object', 'table'] },
	buffered: { appliesTo: ['audio', 'video'] },
	challenge: { appliesTo: ['keygen'] },
	charset: { appliesTo: ['meta', 'script'] },
	checked: { appliesTo: ['command', 'input'] },
	cite: { appliesTo: ['blockquote', 'del', 'ins', 'q'] },
	class: { propertyName: 'className' },
	code: { appliesTo: ['applet'] },
	codebase: { propertyName: 'codeBase', appliesTo: ['applet'] },
	color: { appliesTo: ['basefont', 'font', 'hr'] },
	cols: { appliesTo: ['textarea'] },
	colspan: { propertyName: 'colSpan', appliesTo: ['td', 'th'] },
	content: { appliesTo: ['meta'] },
	contenteditable: { propertyName: 'contentEditable' },
	contextmenu: {},
	controls: { appliesTo: ['audio', 'video'] },
	coords: { appliesTo: ['area'] },
	data: { appliesTo: ['object'] },
	datetime: { propertyName: 'dateTime', appliesTo: ['del', 'ins', 'time'] },
	default: { appliesTo: ['track'] },
	defer: { appliesTo: ['script'] },
	dir: {},
	dirname: { propertyName: 'dirName', appliesTo: ['input', 'textarea'] },
	disabled: {
		appliesTo: [
			'button',
			'command',
			'fieldset',
			'input',
			'keygen',
			'optgroup',
			'option',
			'select',
			'textarea',
		],
	},
	download: { appliesTo: ['a', 'area'] },
	draggable: {},
	dropzone: {},
	enctype: { appliesTo: ['form'] },
	for: { propertyName: 'htmlFor', appliesTo: ['label', 'output'] },
	form: {
		appliesTo: [
			'button',
			'fieldset',
			'input',
			'keygen',
			'label',
			'meter',
			'object',
			'output',
			'progress',
			'select',
			'textarea',
		],
	},
	formaction: { appliesTo: ['input', 'button'] },
	headers: { appliesTo: ['td', 'th'] },
	height: {
		appliesTo: ['canvas', 'embed', 'iframe', 'img', 'input', 'object', 'video'],
	},
	hidden: {},
	high: { appliesTo: ['meter'] },
	href: { appliesTo: ['a', 'area', 'base', 'link'] },
	hreflang: { appliesTo: ['a', 'area', 'link'] },
	'http-equiv': { propertyName: 'httpEquiv', appliesTo: ['meta'] },
	icon: { appliesTo: ['command'] },
	id: {},
	indeterminate: { appliesTo: ['input'] },
	ismap: { propertyName: 'isMap', appliesTo: ['img'] },
	itemprop: {},
	keytype: { appliesTo: ['keygen'] },
	kind: { appliesTo: ['track'] },
	label: { appliesTo: ['track'] },
	lang: {},
	language: { appliesTo: ['script'] },
	loop: { appliesTo: ['audio', 'bgsound', 'marquee', 'video'] },
	low: { appliesTo: ['meter'] },
	manifest: { appliesTo: ['html'] },
	max: { appliesTo: ['input', 'meter', 'progress'] },
	maxlength: { propertyName: 'maxLength', appliesTo: ['input', 'textarea'] },
	media: { appliesTo: ['a', 'area', 'link', 'source', 'style'] },
	method: { appliesTo: ['form'] },
	min: { appliesTo: ['input', 'meter'] },
	multiple: { appliesTo: ['input', 'select'] },
	muted: { appliesTo: ['audio', 'video'] },
	name: {
		appliesTo: [
			'button',
			'form',
			'fieldset',
			'iframe',
			'input',
			'keygen',
			'object',
			'output',
			'select',
			'textarea',
			'map',
			'meta',
			'param',
		],
	},
	novalidate: { propertyName: 'noValidate', appliesTo: ['form'] },
	open: { appliesTo: ['details'] },
	optimum: { appliesTo: ['meter'] },
	pattern: { appliesTo: ['input'] },
	ping: { appliesTo: ['a', 'area'] },
	placeholder: { appliesTo: ['input', 'textarea'] },
	poster: { appliesTo: ['video'] },
	preload: { appliesTo: ['audio', 'video'] },
	radiogroup: { appliesTo: ['command'] },
	readonly: { propertyName: 'readOnly', appliesTo: ['input', 'textarea'] },
	rel: { appliesTo: ['a', 'area', 'link'] },
	required: { appliesTo: ['input', 'select', 'textarea'] },
	reversed: { appliesTo: ['ol'] },
	rows: { appliesTo: ['textarea'] },
	rowspan: { propertyName: 'rowSpan', appliesTo: ['td', 'th'] },
	sandbox: { appliesTo: ['iframe'] },
	scope: { appliesTo: ['th'] },
	scoped: { appliesTo: ['style'] },
	seamless: { appliesTo: ['iframe'] },
	selected: { appliesTo: ['option'] },
	shape: { appliesTo: ['a', 'area'] },
	size: { appliesTo: ['input', 'select'] },
	sizes: { appliesTo: ['link', 'img', 'source'] },
	span: { appliesTo: ['col', 'colgroup'] },
	spellcheck: {},
	src: {
		appliesTo: [
			'audio',
			'embed',
			'iframe',
			'img',
			'input',
			'script',
			'source',
			'track',
			'video',
		],
	},
	srcdoc: { appliesTo: ['iframe'] },
	srclang: { appliesTo: ['track'] },
	srcset: { appliesTo: ['img'] },
	start: { appliesTo: ['ol'] },
	step: { appliesTo: ['input'] },
	style: { propertyName: 'style.cssText' },
	summary: { appliesTo: ['table'] },
	tabindex: { propertyName: 'tabIndex' },
	target: { appliesTo: ['a', 'area', 'base', 'form'] },
	title: {},
	type: {
		appliesTo: [
			'button',
			'command',
			'embed',
			'object',
			'script',
			'source',
			'style',
			'menu',
		],
	},
	usemap: { propertyName: 'useMap', appliesTo: ['img', 'input', 'object'] },
	value: {
		appliesTo: [
			'button',
			'option',
			'input',
			'li',
			'meter',
			'progress',
			'param',
			'select',
			'textarea',
		],
	},
	volume: { appliesTo: ['audio', 'video'] },
	width: {
		appliesTo: ['canvas', 'embed', 'iframe', 'img', 'input', 'object', 'video'],
	},
	wrap: { appliesTo: ['textarea'] },
};

Object.keys(attributeLookup).forEach(name => {
	const metadata = attributeLookup[name];
	if (!metadata.propertyName) metadata.propertyName = name;
});

function optimizeStyle(value: Node[]) {
	let expectingKey = true;
	let i = 0;

	const props: { key: string, value: Node[] }[] = [];
	let chunks = value.slice();

	while (chunks.length) {
		const chunk = chunks[0];

		if (chunk.type !== 'Text') return null;

		const keyMatch = /^\s*([\w-]+):\s*/.exec(chunk.data);
		if (!keyMatch) return null;

		const key = keyMatch[1];

		const offset = keyMatch.index + keyMatch[0].length;
		const remainingData = chunk.data.slice(offset);

		if (remainingData) {
			chunks[0] = {
				start: chunk.start + offset,
				end: chunk.end,
				type: 'Text',
				data: remainingData
			};
		} else {
			chunks.shift();
		}

		const result = getStyleValue(chunks);
		if (!result) return null;

		props.push({ key, value: result.value });
		chunks = result.chunks;
	}

	return props;
}

function getStyleValue(chunks: Node[]) {
	const value: Node[] = [];

	let inUrl = false;
	let quoteMark = null;
	let escaped = false;

	while (chunks.length) {
		const chunk = chunks.shift();

		if (chunk.type === 'Text') {
			let c = 0;
			while (c < chunk.data.length) {
				const char = chunk.data[c];

				if (escaped) {
					escaped = false;
				} else if (char === '\\') {
					escaped = true;
				} else if (char === quoteMark) {
					quoteMark === null;
				} else if (char === '"' || char === "'") {
					quoteMark = char;
				} else if (char === ')' && inUrl) {
					inUrl = false;
				} else if (char === 'u' && chunk.data.slice(c, c + 4) === 'url(') {
					inUrl = true;
				} else if (char === ';' && !inUrl && !quoteMark) {
					break;
				}

				c += 1;
			}

			if (c > 0) {
				value.push({
					type: 'Text',
					start: chunk.start,
					end: chunk.start + c,
					data: chunk.data.slice(0, c)
				});
			}

			while (/[;\s]/.test(chunk.data[c])) c += 1;
			const remainingData = chunk.data.slice(c);

			if (remainingData) {
				chunks.unshift({
					start: chunk.start + c,
					end: chunk.end,
					type: 'Text',
					data: remainingData
				});

				break;
			}
		}

		else {
			value.push(chunk);
		}
	}

	return {
		chunks,
		value
	};
}

function isDynamic(value: Node[]) {
	return value.length > 1 || value[0].type !== 'Text';
}
