import deindent from '../../utils/deindent';
import { stringify, escape } from '../../utils/stringify';
import CodeBuilder from '../../utils/CodeBuilder';
import Component from '../Component';
import Renderer from './Renderer';
import { CompileOptions } from '../../interfaces';
import { walk } from 'estree-walker';
import stringifyProps from '../../utils/stringifyProps';
import addToSet from '../../utils/addToSet';
import getObject from '../../utils/getObject';
import { extractNames } from '../../utils/annotateWithScopes';
import { nodes_match } from '../../utils/nodes_match';
import sanitize from '../../utils/sanitize';

export default function dom(
	component: Component,
	options: CompileOptions
) {
	const { name, code } = component;

	const renderer = new Renderer(component, options);
	const { block } = renderer;

	block.hasOutroMethod = true;

	// prevent fragment being created twice (#1063)
	if (options.customElement) block.builders.create.addLine(`this.c = @noop;`);

	const builder = new CodeBuilder();

	if (component.compileOptions.dev) {
		builder.addLine(`const ${renderer.fileVar} = ${JSON.stringify(component.file)};`);
	}

	const css = component.stylesheet.render(options.filename, !options.customElement);
	const styles = component.stylesheet.hasStyles && stringify(options.dev ?
		`${css.code}\n/*# sourceMappingURL=${css.map.toUrl()} */` :
		css.code, { onlyEscapeAtSymbol: true });

	if (styles && component.compileOptions.css !== false && !options.customElement) {
		builder.addBlock(deindent`
			function @add_css() {
				var style = @createElement("style");
				style.id = '${component.stylesheet.id}-style';
				style.textContent = ${styles};
				@append(document.head, style);
			}
		`);
	}

	// fix order
	// TODO the deconflicted names of blocks are reversed... should set them here
	const blocks = renderer.blocks.slice().reverse();

	blocks.forEach(block => {
		builder.addBlock(block.toString());
	});

	if (options.dev && !options.hydratable) {
		block.builders.claim.addLine(
			'throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");'
		);
	}

	// TODO injecting CSS this way is kinda dirty. Maybe it should be an
	// explicit opt-in, or something?
	const should_add_css = (
		!options.customElement &&
		component.stylesheet.hasStyles &&
		options.css !== false
	);

	const $$props = component.uses_props ? `$$new_props` : `$$props`;
	const props = component.vars.filter(variable => !variable.module && variable.export_name);
	const writable_props = props.filter(variable => variable.writable);

	const set = (component.uses_props || writable_props.length > 0 || renderer.slots.size > 0)
		? deindent`
			${$$props} => {
				${component.uses_props && component.invalidate('$$props', `$$props = @assign(@assign({}, $$props), $$new_props)`)}
				${writable_props.map(prop =>
				`if ('${prop.export_name}' in $$props) ${component.invalidate(prop.name, `${prop.name} = $$props.${prop.export_name}`)};`
				)}
				${renderer.slots.size > 0 &&
				`if ('$$scope' in ${$$props}) ${component.invalidate('$$scope', `$$scope = ${$$props}.$$scope`)};`}
			}
		`
		: null;

	const body = [];

	const not_equal = component.componentOptions.immutable ? `@not_equal` : `@safe_not_equal`;
	let dev_props_check;

	props.forEach(x => {
		const variable = component.var_lookup.get(x.name);

		if (variable.hoistable) {
			body.push(deindent`
				get ${x.export_name}() {
					return ${x.name};
				}
			`);
		} else {
			body.push(deindent`
				get ${x.export_name}() {
					return this.$$.ctx.${x.name};
				}
			`);
		}

		if (variable.writable && !renderer.readonly.has(x.export_name)) {
			body.push(deindent`
				set ${x.export_name}(${x.name}) {
					this.$set({ ${x.name} });
					@flush();
				}
			`);
		} else if (component.compileOptions.dev) {
			body.push(deindent`
				set ${x.export_name}(value) {
					throw new Error("<${component.tag}>: Cannot set read-only property '${x.export_name}'");
				}
			`);
		}
	});

	if (component.compileOptions.dev) {
		// TODO check no uunexpected props were passed, as well as
		// checking that expected ones were passed
		const expected = props.filter(prop => !prop.initialised);

		if (expected.length) {
			dev_props_check = deindent`
				const { ctx } = this.$$;
				const props = ${options.customElement ? `this.attributes` : `options.props || {}`};
				${expected.map(prop => deindent`
				if (ctx.${prop.name} === undefined && !('${prop.export_name}' in props)) {
					console.warn("<${component.tag}> was created without expected prop '${prop.export_name}'");
				}`)}
			`;
		}
	}

	// instrument assignments
	if (component.ast.instance) {
		let scope = component.instance_scope;
		let map = component.instance_scope_map;

		let pending_assignments = new Set();

		walk(component.ast.instance.content, {
			enter: (node, parent) => {
				if (map.has(node)) {
					scope = map.get(node);
				}
			},

			leave(node, parent) {
				if (map.has(node)) {
					scope = scope.parent;
				}

				if (node.type === 'AssignmentExpression') {
					const names = node.left.type === 'MemberExpression'
						? [getObject(node.left).name]
						: extractNames(node.left);

					if (node.operator === '=' && nodes_match(node.left, node.right)) {
						const dirty = names.filter(name => {
							return scope.findOwner(name) === component.instance_scope;
						});

						if (dirty.length) component.has_reactive_assignments = true;

						code.overwrite(node.start, node.end, dirty.map(n => component.invalidate(n)).join('; '));
					} else {
						names.forEach(name => {
							const owner = scope.findOwner(name);
							if (owner && owner !== component.instance_scope) return;

							const variable = component.var_lookup.get(name);
							if (variable && (variable.hoistable || variable.global || variable.module)) return;

							pending_assignments.add(name);
							component.has_reactive_assignments = true;
						});
					}
				}

				else if (node.type === 'UpdateExpression') {
					const { name } = getObject(node.argument);

					if (scope.findOwner(name) !== component.instance_scope) return;

					const variable = component.var_lookup.get(name);
					if (variable && variable.hoistable) return;

					pending_assignments.add(name);
					component.has_reactive_assignments = true;
				}

				if (pending_assignments.size > 0) {
					if (node.type === 'ArrowFunctionExpression') {
						const insert = Array.from(pending_assignments).map(name => component.invalidate(name)).join('; ');
						pending_assignments = new Set();

						code.prependRight(node.body.start, `{ const $$result = `);
						code.appendLeft(node.body.end, `; ${insert}; return $$result; }`);

						pending_assignments = new Set();
					}

					else if (/Statement/.test(node.type)) {
						const insert = Array.from(pending_assignments).map(name => component.invalidate(name)).join('; ');

						if (/^(Break|Continue|Return)Statement/.test(node.type)) {
							if (node.argument) {
								code.overwrite(node.start, node.argument.start, `var $$result = `);
								code.appendLeft(node.argument.end, `; ${insert}; return $$result`);
							} else {
								code.prependRight(node.start, `${insert}; `);
							}
						} else if (parent && /(If|For(In|Of)?|While)Statement/.test(parent.type) && node.type !== 'BlockStatement') {
							code.prependRight(node.start, '{ ');
							code.appendLeft(node.end, `${code.original[node.end - 1] === ';' ? '' : ';'} ${insert}; }`);
						} else {
							code.appendLeft(node.end, `${code.original[node.end - 1] === ';' ? '' : ';'} ${insert};`);
						}

						pending_assignments = new Set();
					}
				}
			}
		});

		if (pending_assignments.size > 0) {
			throw new Error(`TODO this should not happen!`);
		}

		component.rewrite_props(({ name, reassigned }) => {
			const value = `$${name}`;

			const callback = `$value => { ${value} = $$value; $$invalidate('${value}', ${value}) }`;

			if (reassigned) {
				return `$$subscribe_${name}()`;
			}

			const subscribe = component.helper('subscribe');

			let insert = `${subscribe}($$self, ${name}, $${callback})`;
			if (component.compileOptions.dev) {
				const validate_store = component.helper('validate_store');
				insert = `${validate_store}(${name}, '${name}'); ${insert}`;
			}

			return insert;
		});
	}

	const args = ['$$self'];
	if (props.length > 0 || component.has_reactive_assignments || renderer.slots.size > 0) {
		args.push('$$props', '$$invalidate');
	}

	builder.addBlock(deindent`
		function create_fragment(ctx) {
			${block.getContents()}
		}

		${component.module_javascript}

		${component.fully_hoisted.length > 0 && component.fully_hoisted.join('\n\n')}
	`);

	const filtered_declarations = component.vars
		.filter(v => ((v.referenced || v.export_name) && !v.hoistable))
		.map(v => v.name);

	if (component.uses_props) filtered_declarations.push(`$$props: $$props = ${component.helper('exclude_internal_props')}($$props)`);

	const filtered_props = props.filter(prop => {
		const variable = component.var_lookup.get(prop.name);

		if (variable.hoistable) return false;
		if (prop.name[0] === '$') return false;
		return true;
	});

	const reactive_stores = component.vars.filter(variable => variable.name[0] === '$');

	if (renderer.slots.size > 0) {
		const arr = Array.from(renderer.slots);
		filtered_declarations.push(...arr.map(name => `$$slot_${sanitize(name)}`), '$$scope');
	}

	if (renderer.bindingGroups.length > 0) {
		filtered_declarations.push(`$$binding_groups`);
	}

	const has_definition = (
		component.javascript ||
		filtered_props.length > 0 ||
		component.uses_props ||
		component.partly_hoisted.length > 0 ||
		filtered_declarations.length > 0 ||
		component.reactive_declarations.length > 0
	);

	const definition = has_definition
		? component.alias('instance')
		: 'null';

	const all_reactive_dependencies = new Set();
	component.reactive_declarations.forEach(d => {
		addToSet(all_reactive_dependencies, d.dependencies);
	});

	let user_code;

	if (component.javascript) {
		user_code = component.javascript;
	} else {
		if (!component.ast.instance && !component.ast.module && (filtered_props.length > 0 || component.uses_props)) {
			const statements = [];

			if (filtered_props.length > 0) statements.push(`let { ${filtered_props.map(x => x.name).join(', ')} } = $$props;`);

			reactive_stores.forEach(({ name }) => {
				if (component.compileOptions.dev) {
					statements.push(`${component.compileOptions.dev && `@validate_store(${name.slice(1)}, '${name.slice(1)}');`}`);
				}

				statements.push(`@subscribe($$self, ${name.slice(1)}, $$value => { ${name} = $$value; $$invalidate('${name}', ${name}); });`);
			});

			user_code = statements.join('\n');
		}
	}

	const reactive_store_subscriptions = reactive_stores
		.filter(store => {
			const variable = component.var_lookup.get(store.name.slice(1));
			return variable.hoistable;
		})
		.map(({ name }) => deindent`
			${component.compileOptions.dev && `@validate_store(${name.slice(1)}, '${name.slice(1)}');`}
			@subscribe($$self, ${name.slice(1)}, $$value => { ${name} = $$value; $$invalidate('${name}', ${name}); });
		`);

	const resubscribable_reactive_store_unsubscribers = reactive_stores
		.filter(store => {
			const variable = component.var_lookup.get(store.name.slice(1));
			return variable.reassigned;
		})
		.map(({ name }) => `$$self.$$.on_destroy.push(() => $$unsubscribe_${name.slice(1)}());`);

	if (has_definition) {
		const reactive_declarations = component.reactive_declarations.map(d => {
			const condition = Array.from(d.dependencies)
				.filter(n => {
					const variable = component.var_lookup.get(n);
					return variable && variable.writable;
				})
				.map(n => `$$dirty.${n}`).join(' || ');

			const snippet = d.node.body.type === 'BlockStatement'
				? `[✂${d.node.body.start}-${d.node.end}✂]`
				: deindent`
					{
						[✂${d.node.body.start}-${d.node.end}✂]
					}`;

			return deindent`
				if (${condition}) ${snippet}`
		});

		const injected = Array.from(component.injected_reactive_declaration_vars).filter(name => {
			const variable = component.var_lookup.get(name);
			return variable.injected;
		});

		const reactive_store_declarations = reactive_stores.map(variable => {
			const $name = variable.name;
			const name = $name.slice(1);

			const store = component.var_lookup.get(name);
			if (store.reassigned) {
				return `${$name}, $$unsubscribe_${name} = @noop, $$subscribe_${name} = () => { $$unsubscribe_${name}(); $$unsubscribe_${name} = ${name}.subscribe($$value => { ${$name} = $$value; $$invalidate('${$name}', ${$name}); }) }`
			}

			return $name;
		});

		builder.addBlock(deindent`
			function ${definition}(${args.join(', ')}) {
				${reactive_store_declarations.length > 0 && `let ${reactive_store_declarations.join(', ')};`}

				${reactive_store_subscriptions}

				${resubscribable_reactive_store_unsubscribers}

				${user_code}

				${renderer.slots.size && `let { ${[...renderer.slots].map(name => `$$slot_${sanitize(name)}`).join(', ')}, $$scope } = $$props;`}

				${renderer.bindingGroups.length > 0 && `const $$binding_groups = [${renderer.bindingGroups.map(_ => `[]`).join(', ')}];`}

				${component.partly_hoisted.length > 0 && component.partly_hoisted.join('\n\n')}

				${set && `$$self.$set = ${set};`}

				${reactive_declarations.length > 0 && deindent`
				${injected.length && `let ${injected.join(', ')};`}
				$$self.$$.update = ($$dirty = { ${Array.from(all_reactive_dependencies).map(n => `${n}: 1`).join(', ')} }) => {
					${reactive_declarations}
				};
				`}

				return ${stringifyProps(filtered_declarations)};
			}
		`);
	}

	if (options.customElement) {
		builder.addBlock(deindent`
			class ${name} extends @SvelteElement {
				constructor(options) {
					super();

					${css.code && `this.shadowRoot.innerHTML = \`<style>${escape(css.code, { onlyEscapeAtSymbol: true }).replace(/\\/g, '\\\\')}${options.dev ? `\n/*# sourceMappingURL=${css.map.toUrl()} */` : ''}</style>\`;`}

					@init(this, { target: this.shadowRoot }, ${definition}, create_fragment, ${not_equal});

					${dev_props_check}

					if (options) {
						if (options.target) {
							@insert(options.target, this, options.anchor);
						}

						${(props.length > 0 || component.uses_props) && deindent`
						if (options.props) {
							this.$set(options.props);
							@flush();
						}`}
					}
				}

				static get observedAttributes() {
					return ${JSON.stringify(props.map(x => x.export_name))};
				}

				${body.length > 0 && body.join('\n\n')}
			}

			customElements.define("${component.tag}", ${name});
		`);
	} else {
		const superclass = options.dev ? 'SvelteComponentDev' : 'SvelteComponent';

		builder.addBlock(deindent`
			class ${name} extends @${superclass} {
				constructor(options) {
					super(${options.dev && `options`});
					${should_add_css && `if (!document.getElementById("${component.stylesheet.id}-style")) @add_css();`}
					@init(this, options, ${definition}, create_fragment, ${not_equal});

					${dev_props_check}
				}

				${body.length > 0 && body.join('\n\n')}
			}
		`);
	}

	return builder.toString();
}
