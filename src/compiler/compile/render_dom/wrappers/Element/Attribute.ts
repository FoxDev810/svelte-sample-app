import Attribute from '../../../nodes/Attribute';
import Block from '../../Block';
import fix_attribute_casing from './fix_attribute_casing';
import ElementWrapper from './index';
import { string_literal } from '../../../utils/stringify';
import { b, x } from 'code-red';
import Expression from '../../../nodes/shared/Expression';
import Text from '../../../nodes/Text';
import { changed } from '../shared/changed';
import { Literal } from 'estree';

export default class AttributeWrapper {
	node: Attribute;
	parent: ElementWrapper;

	constructor(parent: ElementWrapper, block: Block, node: Attribute) {
		this.node = node;
		this.parent = parent;

		if (node.dependencies.size > 0) {
			parent.cannot_use_innerhtml();

			block.add_dependencies(node.dependencies);

			// special case — <option value={foo}> — see below
			if (this.parent.node.name === 'option' && node.name === 'value') {
				let select: ElementWrapper = this.parent;
				while (select && (select.node.type !== 'Element' || select.node.name !== 'select'))
					// @ts-ignore todo: doublecheck this, but looks to be correct
					select = select.parent;

				if (select && select.select_binding_dependencies) {
					select.select_binding_dependencies.forEach(prop => {
						this.node.dependencies.forEach((dependency: string) => {
							this.parent.renderer.component.indirect_dependencies.get(prop).add(dependency);
						});
					});
				}
			}
		}
	}

	render(block: Block) {
		const element = this.parent;
		const name = fix_attribute_casing(this.node.name);

		const metadata = this.get_metadata();

		const is_indirectly_bound_value =
			name === 'value' &&
			(element.node.name === 'option' || // TODO check it's actually bound
				(element.node.name === 'input' &&
					element.node.bindings.find(
						(binding) =>
							/checked|group/.test(binding.name)
					)));

		const property_name = is_indirectly_bound_value
			? '__value'
			: metadata && metadata.property_name;

		// xlink is a special case... we could maybe extend this to generic
		// namespaced attributes but I'm not sure that's applicable in
		// HTML5?
		const method = /-/.test(element.node.name)
			? '@set_custom_element_data'
			: name.slice(0, 6) === 'xlink:'
				? '@xlink_attr'
				: '@attr';

		const is_legacy_input_type = element.renderer.component.compile_options.legacy && name === 'type' && this.parent.node.name === 'input';

		const dependencies = this.node.get_dependencies();
		if (dependencies.length > 0) {
			let value;

			// TODO some of this code is repeated in Tag.ts — would be good to
			// DRY it out if that's possible without introducing crazy indirection
			if (this.node.chunks.length === 1) {
				// single {tag} — may be a non-string
				value = (this.node.chunks[0] as Expression).manipulate(block);
			} else {
				value = this.node.name === 'class'
					? this.get_class_name_text()
					: this.render_chunks().reduce((lhs, rhs) => x`${lhs} + ${rhs}`);

				// '{foo} {bar}' — treat as string concatenation
				if (this.node.chunks[0].type !== 'Text') {
					value = x`"" + ${value}`;
				}
			}

			const is_select_value_attribute =
				name === 'value' && element.node.name === 'select';

			const should_cache = is_select_value_attribute; // TODO is this necessary?

			const last = should_cache && block.get_unique_name(
				`${element.var.name}_${name.replace(/[^a-zA-Z_$]/g, '_')}_value`
			);

			if (should_cache) block.add_variable(last);

			let updater;
			const init = should_cache ? x`${last} = ${value}` : value;

			if (is_legacy_input_type) {
				block.chunks.hydrate.push(
					b`@set_input_type(${element.var}, ${init});`
				);
				updater = b`@set_input_type(${element.var}, ${should_cache ? last : value});`;
			} else if (is_select_value_attribute) {
				// annoying special case
				const is_multiple_select = element.node.get_static_attribute_value('multiple');
				const i = block.get_unique_name('i');
				const option = block.get_unique_name('option');

				const if_statement = is_multiple_select
					? b`
						${option}.selected = ~${last}.indexOf(${option}.__value);`
					: b`
						if (${option}.__value === ${last}) {
							${option}.selected = true;
							${{ type: 'BreakStatement' }};
						}`; // TODO the BreakStatement is gross, but it's unsyntactic otherwise...

				updater = b`
					for (var ${i} = 0; ${i} < ${element.var}.options.length; ${i} += 1) {
						var ${option} = ${element.var}.options[${i}];

						${if_statement}
					}
				`;

				block.chunks.mount.push(b`
					${last} = ${value};
					${updater}
				`);
			} else if (property_name) {
				block.chunks.hydrate.push(
					b`${element.var}.${property_name} = ${init};`
				);
				updater = block.renderer.options.dev
					? b`@prop_dev(${element.var}, "${property_name}", ${should_cache ? last : value});`
					: b`${element.var}.${property_name} = ${should_cache ? last : value};`;
			} else {
				block.chunks.hydrate.push(
					b`${method}(${element.var}, "${name}", ${init});`
				);
				updater = b`${method}(${element.var}, "${name}", ${should_cache ? last : value});`;
			}

			let condition = changed(dependencies);

			if (should_cache) {
				condition = x`${condition} && (${last} !== (${last} = ${value}))`;
			}

			if (block.has_outros) {
				condition = x`!#current || ${condition}`;
			}

			block.chunks.update.push(b`
				if (${condition}) {
					${updater}
				}`);
		} else {
			const value = this.node.get_value(block);

			const statement = (
				is_legacy_input_type
					? b`@set_input_type(${element.var}, ${value});`
					: property_name
						? b`${element.var}.${property_name} = ${value};`
						: b`${method}(${element.var}, "${name}", ${value.type === 'Literal' && (value as Literal).value === true ? x`""` : value});`
			);

			block.chunks.hydrate.push(statement);

			// special case – autofocus. has to be handled in a bit of a weird way
			if (this.node.is_true && name === 'autofocus') {
				block.autofocus = element.var;
			}
		}

		if (is_indirectly_bound_value) {
			const update_value = b`${element.var}.value = ${element.var}.__value;`;

			block.chunks.hydrate.push(update_value);
			if (this.node.get_dependencies().length > 0) block.chunks.update.push(update_value);
		}
	}

	get_metadata() {
		if (this.parent.node.namespace) return null;
		const metadata = attribute_lookup[fix_attribute_casing(this.node.name)];
		if (metadata && metadata.applies_to && !metadata.applies_to.includes(this.parent.node.name)) return null;
		return metadata;
	}

	get_class_name_text() {
		const scoped_css = this.node.chunks.some((chunk: Text) => chunk.synthetic);
		const rendered = this.render_chunks();

		if (scoped_css && rendered.length === 2) {
			// we have a situation like class={possiblyUndefined}
			rendered[0] = x`@null_to_empty(${rendered[0]})`;
		}

		return rendered.reduce((lhs, rhs) => x`${lhs} + ${rhs}`);
	}

	render_chunks() {
		return this.node.chunks.map((chunk) => {
			if (chunk.type === 'Text') {
				return string_literal(chunk.data);
			}

			return chunk.manipulate();
		});
	}

	stringify() {
		if (this.node.is_true) return '';

		const value = this.node.chunks;
		if (value.length === 0) return `=""`;

		return `="${value.map(chunk => {
			return chunk.type === 'Text'
				? chunk.data.replace(/"/g, '\\"')
				: `\${${chunk.manipulate()}}`;
		}).join('')}"`;
	}
}

// source: https://html.spec.whatwg.org/multipage/indices.html
const attribute_lookup = {
	allowfullscreen: { property_name: 'allowFullscreen', applies_to: ['iframe'] },
	allowpaymentrequest: { property_name: 'allowPaymentRequest', applies_to: ['iframe'] },
	async: { applies_to: ['script'] },
	autofocus: { applies_to: ['button', 'input', 'keygen', 'select', 'textarea'] },
	autoplay: { applies_to: ['audio', 'video'] },
	checked: { applies_to: ['input'] },
	controls: { applies_to: ['audio', 'video'] },
	default: { applies_to: ['track'] },
	defer: { applies_to: ['script'] },
	disabled: {
		applies_to: [
			'button',
			'fieldset',
			'input',
			'keygen',
			'optgroup',
			'option',
			'select',
			'textarea',
		],
	},
	formnovalidate: { property_name: 'formNoValidate', applies_to: ['button', 'input'] },
	hidden: {},
	indeterminate: { applies_to: ['input'] },
	ismap: { property_name: 'isMap', applies_to: ['img'] },
	loop: { applies_to: ['audio', 'bgsound', 'video'] },
	multiple: { applies_to: ['input', 'select'] },
	muted: { applies_to: ['audio', 'video'] },
	nomodule: { property_name: 'noModule', applies_to: ['script'] },
	novalidate: { property_name: 'noValidate', applies_to: ['form'] },
	open: { applies_to: ['details', 'dialog'] },
	playsinline: { property_name: 'playsInline', applies_to: ['video'] },
	readonly: { property_name: 'readOnly', applies_to: ['input', 'textarea'] },
	required: { applies_to: ['input', 'select', 'textarea'] },
	reversed: { applies_to: ['ol'] },
	selected: { applies_to: ['option'] },
	value: {
		applies_to: [
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
};

Object.keys(attribute_lookup).forEach(name => {
	const metadata = attribute_lookup[name];
	if (!metadata.property_name) metadata.property_name = name;
});
