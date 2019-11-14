import Renderer from '../../Renderer';
import Element from '../../../nodes/Element';
import Wrapper from '../shared/Wrapper';
import Block from '../../Block';
import { is_void, sanitize } from '../../../../utils/names';
import FragmentWrapper from '../Fragment';
import { escape_html, string_literal } from '../../../utils/stringify';
import TextWrapper from '../Text';
import TagWrapper from '../shared/Tag';
import fix_attribute_casing from './fix_attribute_casing';
import { b, x, p } from 'code-red';
import { namespaces } from '../../../../utils/namespaces';
import AttributeWrapper from './Attribute';
import StyleAttributeWrapper from './StyleAttribute';
import { dimensions } from '../../../../utils/patterns';
import Binding from './Binding';
import InlineComponentWrapper from '../InlineComponent';
import add_to_set from '../../../utils/add_to_set';
import add_event_handlers from '../shared/add_event_handlers';
import add_actions from '../shared/add_actions';
import create_debugging_comment from '../shared/create_debugging_comment';
import { get_context_merger } from '../shared/get_context_merger';
import bind_this from '../shared/bind_this';
import { changed } from '../shared/changed';
import { is_head } from '../shared/is_head';
import { Identifier } from 'estree';
import EventHandler from './EventHandler';

const events = [
	{
		event_names: ['input'],
		filter: (node: Element, _name: string) =>
			node.name === 'textarea' ||
			node.name === 'input' && !/radio|checkbox|range|file/.test(node.get_static_attribute_value('type') as string)
	},
	{
		event_names: ['input'],
		filter: (node: Element, name: string) =>
			(name === 'textContent' || name === 'innerHTML') &&
			node.attributes.some(attribute => attribute.name === 'contenteditable')
	},
	{
		event_names: ['change'],
		filter: (node: Element, _name: string) =>
			node.name === 'select' ||
			node.name === 'input' && /radio|checkbox|file/.test(node.get_static_attribute_value('type') as string)
	},
	{
		event_names: ['change', 'input'],
		filter: (node: Element, _name: string) =>
			node.name === 'input' && node.get_static_attribute_value('type') === 'range'
	},

	{
		event_names: ['resize'],
		filter: (_node: Element, name: string) =>
			dimensions.test(name)
	},

	// media events
	{
		event_names: ['timeupdate'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			(name === 'currentTime' || name === 'played' || name === 'ended')
	},
	{
		event_names: ['durationchange'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			name === 'duration'
	},
	{
		event_names: ['play', 'pause'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			name === 'paused'
	},
	{
		event_names: ['progress'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			name === 'buffered'
	},
	{
		event_names: ['loadedmetadata'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			(name === 'buffered' || name === 'seekable')
	},
	{
		event_names: ['volumechange'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			name === 'volume'
	},
	{
		event_names: ['ratechange'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			name === 'playbackRate'
	},
	{
		event_names: ['seeking', 'seeked'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			(name === 'seeking')
	},
	{
		event_names: ['ended'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			name === 'ended'
	},

	// details event
	{
		event_names: ['toggle'],
		filter: (node: Element, _name: string) =>
			node.name === 'details'
	},
];

export default class ElementWrapper extends Wrapper {
	node: Element;
	fragment: FragmentWrapper;
	attributes: AttributeWrapper[];
	bindings: Binding[];
	event_handlers: EventHandler[];
	class_dependencies: string[];

	slot_block: Block;
	select_binding_dependencies?: Set<string>;

	var: any;
	void: boolean;

	constructor(
		renderer: Renderer,
		block: Block,
		parent: Wrapper,
		node: Element,
		strip_whitespace: boolean,
		next_sibling: Wrapper
	) {
		super(renderer, block, parent, node);
		this.var = {
			type: 'Identifier',
			name: node.name.replace(/[^a-zA-Z0-9_$]/g, '_')
		};

		this.void = is_void(node.name);

		this.class_dependencies = [];

		this.attributes = this.node.attributes.map(attribute => {
			if (attribute.name === 'slot') {
				// TODO make separate subclass for this?
				let owner = this.parent;
				while (owner) {
					if (owner.node.type === 'InlineComponent') {
						break;
					}

					if (owner.node.type === 'Element' && /-/.test(owner.node.name)) {
						break;
					}

					owner = owner.parent;
				}

				if (owner && owner.node.type === 'InlineComponent') {
					const name = attribute.get_static_value() as string;

					if (!(owner as unknown as InlineComponentWrapper).slots.has(name)) {
						const child_block = block.child({
							comment: create_debugging_comment(node, this.renderer.component),
							name: this.renderer.component.get_unique_name(`create_${sanitize(name)}_slot`),
							type: 'slot'
						});

						const lets = this.node.lets;
						const seen = new Set(lets.map(l => l.name.name));

						(owner as unknown as InlineComponentWrapper).node.lets.forEach(l => {
							if (!seen.has(l.name.name)) lets.push(l);
						});

						const fn = get_context_merger(lets);

						(owner as unknown as InlineComponentWrapper).slots.set(name, {
							block: child_block,
							scope: this.node.scope,
							fn
						});
						this.renderer.blocks.push(child_block);
					}

					this.slot_block = (owner as unknown as InlineComponentWrapper).slots.get(name).block;
					block = this.slot_block;
				}
			}
			if (attribute.name === 'style') {
				return new StyleAttributeWrapper(this, block, attribute);
			}
			return new AttributeWrapper(this, block, attribute);
		});

		// ordinarily, there'll only be one... but we need to handle
		// the rare case where an element can have multiple bindings,
		// e.g. <audio bind:paused bind:currentTime>
		this.bindings = this.node.bindings.map(binding => new Binding(block, binding, this));

		this.event_handlers = this.node.handlers.map(event_handler => new EventHandler(event_handler, this));

		if (node.intro || node.outro) {
			if (node.intro) block.add_intro(node.intro.is_local);
			if (node.outro) block.add_outro(node.outro.is_local);
		}

		if (node.animation) {
			block.add_animation();
		}

		// add directive and handler dependencies
		[node.animation, node.outro, ...node.actions, ...node.classes].forEach(directive => {
			if (directive && directive.expression) {
				block.add_dependencies(directive.expression.dependencies);
			}
		});

		node.handlers.forEach(handler => {
			if (handler.expression) {
				block.add_dependencies(handler.expression.dependencies);
			}
		});

		if (this.parent) {
			if (node.actions.length > 0 ||
				node.animation ||
				node.bindings.length > 0 ||
				node.classes.length > 0 ||
				node.intro || node.outro ||
				node.handlers.length > 0 ||
				this.node.name === 'option' ||
				renderer.options.dev
			) {
				this.parent.cannot_use_innerhtml(); // need to use add_location
				this.parent.not_static_content();
			}
		}

		this.fragment = new FragmentWrapper(renderer, block, node.children, this, strip_whitespace, next_sibling);

		if (this.slot_block) {
			block.parent.add_dependencies(block.dependencies);

			// appalling hack
			const index = block.parent.wrappers.indexOf(this);
			block.parent.wrappers.splice(index, 1);
			block.wrappers.push(this);
		}
	}

	render(block: Block, parent_node: Identifier, parent_nodes: Identifier) {
		const { renderer } = this;

		if (this.node.name === 'noscript') return;

		if (this.slot_block) {
			block = this.slot_block;
		}

		const node = this.var;
		const nodes = parent_nodes && block.get_unique_name(`${this.var.name}_nodes`); // if we're in unclaimable territory, i.e. <head>, parent_nodes is null
		const children = x`@children(${this.node.name === 'template' ? x`${node}.content` : node})`;

		block.add_variable(node);
		const render_statement = this.get_render_statement();
		block.chunks.create.push(
			b`${node} = ${render_statement};`
		);

		if (renderer.options.hydratable) {
			if (parent_nodes) {
				block.chunks.claim.push(b`
					${node} = ${this.get_claim_statement(parent_nodes)};
				`);

				if (!this.void && this.node.children.length > 0) {
					block.chunks.claim.push(b`
						var ${nodes} = ${children};
					`);
				}
			} else {
				block.chunks.claim.push(
					b`${node} = ${render_statement};`
				);
			}
		}

		if (parent_node) {
			block.chunks.mount.push(
				b`@append(${parent_node}, ${node});`
			);

			if (is_head(parent_node)) {
				block.chunks.destroy.push(b`@detach(${node});`);
			}
		} else {
			block.chunks.mount.push(b`@insert(#target, ${node}, anchor);`);

			// TODO we eventually need to consider what happens to elements
			// that belong to the same outgroup as an outroing element...
			block.chunks.destroy.push(b`if (detaching) @detach(${node});`);
		}

		// insert static children with textContent or innerHTML
		const can_use_textcontent = this.can_use_textcontent();
		if (!this.node.namespace && (this.can_use_innerhtml || can_use_textcontent) && this.fragment.nodes.length > 0) {
			if (this.fragment.nodes.length === 1 && this.fragment.nodes[0].node.type === 'Text') {
				block.chunks.create.push(
					 // @ts-ignore todo: should it be this.fragment.nodes[0].node.data instead?
					b`${node}.textContent = ${string_literal(this.fragment.nodes[0].data)};`
				);
			} else {
				const state = {
					quasi: {
						type: 'TemplateElement',
						value: { raw: '' }
					}
				};

				const literal = {
					type: 'TemplateLiteral',
					expressions: [],
					quasis: []
				};

				const can_use_raw_text = !this.can_use_innerhtml && can_use_textcontent;
				to_html((this.fragment.nodes as unknown as Array<ElementWrapper | TextWrapper>), block, literal, state, can_use_raw_text);
				literal.quasis.push(state.quasi);

				block.chunks.create.push(
					b`${node}.${this.can_use_innerhtml ? 'innerHTML': 'textContent'} = ${literal};`
				);
			}
		} else {
			this.fragment.nodes.forEach((child: Wrapper) => {
				child.render(
					block,
					this.node.name === 'template' ? x`${node}.content` : node,
					nodes
				);
			});
		}

		const event_handler_or_binding_uses_context = (
			this.bindings.some(binding => binding.handler.uses_context) ||
			this.node.handlers.some(handler => handler.uses_context) ||
			this.node.actions.some(action => action.uses_context)
		);

		if (event_handler_or_binding_uses_context) {
			block.maintain_context = true;
		}

		this.add_attributes(block);
		this.add_bindings(block);
		this.add_event_handlers(block);
		this.add_transitions(block);
		this.add_animation(block);
		this.add_actions(block);
		this.add_classes(block);
		this.add_manual_style_scoping(block);

		if (nodes && this.renderer.options.hydratable && !this.void) {
			block.chunks.claim.push(
				b`${this.node.children.length > 0 ? nodes : children}.forEach(@detach);`
			);
		}

		if (renderer.options.dev) {
			const loc = renderer.locate(this.node.start);
			block.chunks.hydrate.push(
				b`@add_location(${this.var}, ${renderer.file_var}, ${loc.line - 1}, ${loc.column}, ${this.node.start});`
			);
		}
	}

	can_use_textcontent() {
		return this.is_static_content && this.fragment.nodes.every(node => node.node.type === 'Text' || node.node.type === 'MustacheTag');
	}

	get_render_statement() {
		const { name, namespace } = this.node;

		if (namespace === 'http://www.w3.org/2000/svg') {
			return x`@svg_element("${name}")`;
		}

		if (namespace) {
			return x`@_document.createElementNS("${namespace}", "${name}")`;
		}

		const is = this.attributes.find(attr => attr.node.name === 'is');
		if (is) {
			return x`@element_is("${name}", ${is.render_chunks().reduce((lhs, rhs) => x`${lhs} + ${rhs}`)});`;
		}

		return x`@element("${name}")`;
	}

	get_claim_statement(nodes: Identifier) {
		const attributes = this.node.attributes
			.filter((attr) => attr.type === 'Attribute')
			.map((attr) => p`${attr.name}: true`);

		const name = this.node.namespace
			? this.node.name
			: this.node.name.toUpperCase();

		const svg = this.node.namespace === namespaces.svg ? 1 : null;

		return x`@claim_element(${nodes}, "${name}", { ${attributes} }, ${svg})`;
	}

	add_bindings(block: Block) {
		const { renderer } = this;

		if (this.bindings.length === 0) return;

		renderer.component.has_reactive_assignments = true;

		const lock = this.bindings.some(binding => binding.needs_lock) ?
			block.get_unique_name(`${this.var.name}_updating`) :
			null;

		if (lock) block.add_variable(lock, x`false`);

		const groups = events
			.map(event => ({
				events: event.event_names,
				bindings: this.bindings
					.filter(binding => binding.node.name !== 'this')
					.filter(binding => event.filter(this.node, binding.node.name))
			}))
			.filter(group => group.bindings.length);

		groups.forEach(group => {
			const handler = renderer.component.get_unique_name(`${this.var.name}_${group.events.join('_')}_handler`);

			renderer.component.add_var({
				name: handler.name,
				internal: true,
				referenced: true
			});

			// TODO figure out how to handle locks
			const needs_lock = group.bindings.some(binding => binding.needs_lock);

			const dependencies = new Set();
			const contextual_dependencies = new Set();

			group.bindings.forEach(binding => {
				// TODO this is a mess
				add_to_set(dependencies, binding.get_dependencies());
				add_to_set(contextual_dependencies, binding.node.expression.contextual_dependencies);
				add_to_set(contextual_dependencies, binding.handler.contextual_dependencies);

				binding.render(block, lock);
			});

			// media bindings — awkward special case. The native timeupdate events
			// fire too infrequently, so we need to take matters into our
			// own hands
			let animation_frame;
			if (group.events[0] === 'timeupdate') {
				animation_frame = block.get_unique_name(`${this.var.name}_animationframe`);
				block.add_variable(animation_frame);
			}

			const has_local_function = contextual_dependencies.size > 0 || needs_lock || animation_frame;

			let callee;

			// TODO dry this out — similar code for event handlers and component bindings
			if (has_local_function) {
				// need to create a block-local function that calls an instance-level function
				if (animation_frame) {
					block.chunks.init.push(b`
						function ${handler}() {
							@_cancelAnimationFrame(${animation_frame});
							if (!${this.var}.paused) {
								${animation_frame} = @raf(${handler});
								${needs_lock && b`${lock} = true;`}
							}
							#ctx.${handler}.call(${this.var}, ${contextual_dependencies.size > 0 ? '#ctx' : null});
						}
					`);
				} else {
					block.chunks.init.push(b`
						function ${handler}() {
							${needs_lock && b`${lock} = true;`}
							#ctx.${handler}.call(${this.var}, ${contextual_dependencies.size > 0 ? '#ctx' : null});
						}
					`);
				}

				callee = handler;
			} else {
				callee = x`#ctx.${handler}`;
			}

			const arg = contextual_dependencies.size > 0 && {
				type: 'ObjectPattern',
				properties: Array.from(contextual_dependencies).map(name => {
					const id = { type: 'Identifier', name };
					return {
						type: 'Property',
						kind: 'init',
						key: id,
						value: id
					};
				})
			};

			this.renderer.component.partly_hoisted.push(b`
				function ${handler}(${arg}) {
					${group.bindings.map(b => b.handler.mutation)}
					${Array.from(dependencies)
						.filter(dep => dep[0] !== '$')
						.filter(dep => !contextual_dependencies.has(dep))
						.map(dep => b`${this.renderer.component.invalidate(dep)};`)}
				}
			`);

			group.events.forEach(name => {
				if (name === 'resize') {
					// special case
					const resize_listener = block.get_unique_name(`${this.var.name}_resize_listener`);
					block.add_variable(resize_listener);

					block.chunks.mount.push(
						b`${resize_listener} = @add_resize_listener(${this.var}, ${callee}.bind(${this.var}));`
					);

					block.chunks.destroy.push(
						b`${resize_listener}.cancel();`
					);
				} else {
					block.event_listeners.push(
						x`@listen(${this.var}, "${name}", ${callee})`
					);
				}
			});

			const some_initial_state_is_undefined = group.bindings
				.map(binding => x`${binding.snippet} === void 0`)
				.reduce((lhs, rhs) => x`${lhs} || ${rhs}`);

			const should_initialise = (
				this.node.name === 'select' ||
				group.bindings.find(binding => {
					return (
						binding.node.name === 'indeterminate' ||
						binding.node.name === 'textContent' ||
						binding.node.name === 'innerHTML' ||
						binding.is_readonly_media_attribute()
					);
				})
			);

			if (should_initialise) {
				const callback = has_local_function ? handler : x`() => ${callee}.call(${this.var})`;
				block.chunks.hydrate.push(
					b`if (${some_initial_state_is_undefined}) @add_render_callback(${callback});`
				);
			}

			if (group.events[0] === 'resize') {
				block.chunks.hydrate.push(
					b`@add_render_callback(() => ${callee}.call(${this.var}));`
				);
			}
		});

		if (lock) {
			block.chunks.update.push(b`${lock} = false;`);
		}

		const this_binding = this.bindings.find(b => b.node.name === 'this');
		if (this_binding) {
			const binding_callback = bind_this(renderer.component, block, this_binding.node, this.var);

			block.chunks.mount.push(binding_callback);
		}
	}

	add_attributes(block: Block) {
		// Get all the class dependencies first
		this.attributes.forEach((attribute) => {
			if (attribute.node.name === 'class') {
				const dependencies = attribute.node.get_dependencies();
				this.class_dependencies.push(...dependencies);
			}
		});

		if (this.node.attributes.some(attr => attr.is_spread)) {
			this.add_spread_attributes(block);
			return;
		}

		this.attributes.forEach((attribute) => {
			attribute.render(block);
		});
	}

	add_spread_attributes(block: Block) {
		const levels = block.get_unique_name(`${this.var.name}_levels`);
		const data = block.get_unique_name(`${this.var.name}_data`);

		const initial_props = [];
		const updates = [];

		this.attributes
			.forEach(attr => {
				const condition = attr.node.dependencies.size > 0
					? changed(Array.from(attr.node.dependencies))
					: null;

				if (attr.node.is_spread) {
					const snippet = attr.node.expression.manipulate(block);

					initial_props.push(snippet);

					updates.push(condition ? x`${condition} && ${snippet}` : snippet);
				} else {
					const metadata = attr.get_metadata();
					const snippet = x`{ ${
						(metadata && metadata.property_name) ||
						fix_attribute_casing(attr.node.name)
					}: ${attr.get_value(block)} }`;
					initial_props.push(snippet);

					updates.push(condition ? x`${condition} && ${snippet}` : snippet);
				}
			});

		block.chunks.init.push(b`
			let ${levels} = [${initial_props}];

			let ${data} = {};
			for (let #i = 0; #i < ${levels}.length; #i += 1) {
				${data} = @assign(${data}, ${levels}[#i]);
			}
		`);

		const fn = this.node.namespace === namespaces.svg ? x`@set_svg_attributes` : x`@set_attributes`;

		block.chunks.hydrate.push(
			b`${fn}(${this.var}, ${data});`
		);

		block.chunks.update.push(b`
			${fn}(${this.var}, @get_spread_update(${levels}, [
				${updates}
			]));
		`);
	}

	add_event_handlers(block: Block) {
		add_event_handlers(block, this.var, this.event_handlers);
	}

	add_transitions(
		block: Block
	) {
		const { intro, outro } = this.node;
		if (!intro && !outro) return;

		const { component } = this.renderer;

		if (intro === outro) {
			// bidirectional transition
			const name = block.get_unique_name(`${this.var.name}_transition`);
			const snippet = intro.expression
				? intro.expression.manipulate(block)
				: x`{}`;

			block.add_variable(name);

			const fn = component.qualify(intro.name);

			const intro_block = b`
				@add_render_callback(() => {
					if (!${name}) ${name} = @create_bidirectional_transition(${this.var}, ${fn}, ${snippet}, true);
					${name}.run(1);
				});
			`;

			const outro_block = b`
				if (!${name}) ${name} = @create_bidirectional_transition(${this.var}, ${fn}, ${snippet}, false);
				${name}.run(0);
			`;

			if (intro.is_local) {
				block.chunks.intro.push(b`
					if (#local) {
						${intro_block}
					}
				`);

				block.chunks.outro.push(b`
					if (#local) {
						${outro_block}
					}
				`);
			} else {
				block.chunks.intro.push(intro_block);
				block.chunks.outro.push(outro_block);
			}

			block.chunks.destroy.push(b`if (detaching && ${name}) ${name}.end();`);
		}

		else {
			const intro_name = intro && block.get_unique_name(`${this.var.name}_intro`);
			const outro_name = outro && block.get_unique_name(`${this.var.name}_outro`);

			if (intro) {
				block.add_variable(intro_name);
				const snippet = intro.expression
					? intro.expression.manipulate(block)
					: x`{}`;

				const fn = component.qualify(intro.name);

				let intro_block;

				if (outro) {
					intro_block = b`
						@add_render_callback(() => {
							if (${outro_name}) ${outro_name}.end(1);
							if (!${intro_name}) ${intro_name} = @create_in_transition(${this.var}, ${fn}, ${snippet});
							${intro_name}.start();
						});
					`;

					block.chunks.outro.push(b`if (${intro_name}) ${intro_name}.invalidate();`);
				} else {
					intro_block = b`
						if (!${intro_name}) {
							@add_render_callback(() => {
								${intro_name} = @create_in_transition(${this.var}, ${fn}, ${snippet});
								${intro_name}.start();
							});
						}
					`;
				}

				if (intro.is_local) {
					intro_block = b`
						if (#local) {
							${intro_block}
						}
					`;
				}

				block.chunks.intro.push(intro_block);
			}

			if (outro) {
				block.add_variable(outro_name);
				const snippet = outro.expression
					? outro.expression.manipulate(block)
					: x`{}`;

				const fn = component.qualify(outro.name);

				if (!intro) {
					block.chunks.intro.push(b`
						if (${outro_name}) ${outro_name}.end(1);
					`);
				}

				// TODO hide elements that have outro'd (unless they belong to a still-outroing
				// group) prior to their removal from the DOM
				let outro_block = b`
					${outro_name} = @create_out_transition(${this.var}, ${fn}, ${snippet});
				`;

				if (outro.is_local) {
					outro_block = b`
						if (#local) {
							${outro_block}
						}
					`;
				}

				block.chunks.outro.push(outro_block);

				block.chunks.destroy.push(b`if (detaching && ${outro_name}) ${outro_name}.end();`);
			}
		}
	}

	add_animation(block: Block) {
		if (!this.node.animation) return;

		const { component } = this.renderer;
		const { outro } = this.node;

		const rect = block.get_unique_name('rect');
		const stop_animation = block.get_unique_name('stop_animation');

		block.add_variable(rect);
		block.add_variable(stop_animation, x`@noop`);

		block.chunks.measure.push(b`
			${rect} = ${this.var}.getBoundingClientRect();
		`);

		block.chunks.fix.push(b`
			@fix_position(${this.var});
			${stop_animation}();
			${outro && b`@add_transform(${this.var}, ${rect});`}
		`);

		const params = this.node.animation.expression ? this.node.animation.expression.manipulate(block) : x`{}`;

		const name = component.qualify(this.node.animation.name);

		block.chunks.animate.push(b`
			${stop_animation}();
			${stop_animation} = @create_animation(${this.var}, ${rect}, ${name}, ${params});
		`);
	}

	add_actions(block: Block) {
		add_actions(this.renderer.component, block, this.var, this.node.actions);
	}

	add_classes(block: Block) {
		const has_spread = this.node.attributes.some(attr => attr.is_spread);
		this.node.classes.forEach(class_directive => {
			const { expression, name } = class_directive;
			let snippet;
			let dependencies;
			if (expression) {
				snippet = expression.manipulate(block);
				dependencies = expression.dependencies;
			} else {
				snippet = name;
				dependencies = new Set([name]);
			}
			const updater = b`@toggle_class(${this.var}, "${name}", ${snippet});`;

			block.chunks.hydrate.push(updater);

			if (has_spread) {
				block.chunks.update.push(updater);
			} else if ((dependencies && dependencies.size > 0) || this.class_dependencies.length) {
				const all_dependencies = this.class_dependencies.concat(...dependencies);
				const condition = changed(all_dependencies);

				block.chunks.update.push(b`
					if (${condition}) {
						${updater}
					}`);
			}
		});
	}

	add_manual_style_scoping(block) {
		if (this.node.needs_manual_style_scoping) {
			const updater = b`@toggle_class(${this.var}, "${this.node.component.stylesheet.id}", true);`;
			block.chunks.hydrate.push(updater);
			block.chunks.update.push(updater);
		}
	}
}

function to_html(wrappers: Array<ElementWrapper | TextWrapper | TagWrapper>, block: Block, literal: any, state: any, can_use_raw_text?: boolean) {
	wrappers.forEach(wrapper => {
		if (wrapper.node.type === 'Text') {
			if ((wrapper as TextWrapper).use_space()) state.quasi.value.raw += ' ';

			const parent = wrapper.node.parent as Element;

			const raw = parent && (
				parent.name === 'script' ||
				parent.name === 'style' ||
				can_use_raw_text
			);

			state.quasi.value.raw += (raw ? wrapper.node.data : escape_html(wrapper.node.data))
				.replace(/\\/g, '\\\\')
				.replace(/`/g, '\\`')
				.replace(/\$/g, '\\$');
		}

		else if (wrapper.node.type === 'MustacheTag' || wrapper.node.type === 'RawMustacheTag' ) {
			literal.quasis.push(state.quasi);
			literal.expressions.push(wrapper.node.expression.manipulate(block));
			state.quasi = {
				type: 'TemplateElement',
				value: { raw: '' }
			};
		}

		else if (wrapper.node.name === 'noscript') {
			// do nothing
		}

		else {
			// element
			state.quasi.value.raw += `<${wrapper.node.name}`;

			(wrapper as ElementWrapper).attributes.forEach((attr: AttributeWrapper) => {
				state.quasi.value.raw += ` ${fix_attribute_casing(attr.node.name)}="`;

				attr.node.chunks.forEach(chunk => {
					if (chunk.type === 'Text') {
						state.quasi.value.raw += escape_html(chunk.data);
					} else {
						literal.quasis.push(state.quasi);
						literal.expressions.push(chunk.manipulate(block));

						state.quasi = {
							type: 'TemplateElement',
							value: { raw: '' }
						};
					}
				});

				state.quasi.value.raw += `"`;
			});

			state.quasi.value.raw += '>';

			if (!(wrapper as ElementWrapper).void) {
				to_html((wrapper as ElementWrapper).fragment.nodes as Array<ElementWrapper | TextWrapper>, block, literal, state);

				state.quasi.value.raw += `</${wrapper.node.name}>`;
			}
		}
	});
}
