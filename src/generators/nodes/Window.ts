import CodeBuilder from '../../utils/CodeBuilder';
import deindent from '../../utils/deindent';
import { stringify } from '../../utils/stringify';
import flattenReference from '../../utils/flattenReference';
import isVoidElementName from '../../utils/isVoidElementName';
import validCalleeObjects from '../../utils/validCalleeObjects';
import reservedNames from '../../utils/reservedNames';
import Node from './shared/Node';
import Block from '../dom/Block';
import Binding from './Binding';
import EventHandler from './EventHandler';

const associatedEvents = {
	innerWidth: 'resize',
	innerHeight: 'resize',
	outerWidth: 'resize',
	outerHeight: 'resize',

	scrollX: 'scroll',
	scrollY: 'scroll',
};

const properties = {
	scrollX: 'pageXOffset',
	scrollY: 'pageYOffset'
};

const readonly = new Set([
	'innerWidth',
	'innerHeight',
	'outerWidth',
	'outerHeight',
	'online',
]);

export default class Window extends Node {
	type: 'Window';
	handlers: EventHandler[];
	bindings: Binding[];

	constructor(compiler, parent, info) {
		super(compiler, parent, info);

		this.handlers = [];
		this.bindings = [];

		info.attributes.forEach(node => {
			if (node.type === 'EventHandler') {
				this.handlers.push(new EventHandler(compiler, this, node));
			} else if (node.type === 'Binding') {
				this.bindings.push(new Binding(compiler, this, node));
			}
		});
	}

	build(
		block: Block,
		parentNode: string,
		parentNodes: string
	) {
		const { compiler } = this;

		const events = {};
		const bindings: Record<string, string> = {};

		this.handlers.forEach(handler => {
			// TODO verify that it's a valid callee (i.e. built-in or declared method)
			compiler.addSourcemapLocations(handler.expression);

			const isCustomEvent = compiler.events.has(handler.name);

			let usesState = handler.dependencies.size > 0;

			// const flattened = flattenReference(handler.expression.callee);
			// if (flattened.name !== 'event' && flattened.name !== 'this') {
			// 	// allow event.stopPropagation(), this.select() etc
			// 	compiler.code.prependRight(
			// 		handler.expression.start,
			// 		`${block.alias('component')}.`
			// 	);
			// }

			const handlerName = block.getUniqueName(`onwindow${handler.name}`);
			const handlerBody = deindent`
				${usesState && `var ctx = #component.get();`}
				${handler.snippet};
			`;

			if (isCustomEvent) {
				// TODO dry this out
				block.addVariable(handlerName);

				block.builders.hydrate.addBlock(deindent`
					${handlerName} = %events-${handler.name}.call(#component, window, function(event) {
						${handlerBody}
					});
				`);

				block.builders.destroy.addLine(deindent`
					${handlerName}.destroy();
				`);
			} else {
				block.builders.init.addBlock(deindent`
					function ${handlerName}(event) {
						${handlerBody}
					}
					window.addEventListener("${handler.name}", ${handlerName});
				`);

				block.builders.destroy.addBlock(deindent`
					window.removeEventListener("${handler.name}", ${handlerName});
				`);
			}
		});

		this.bindings.forEach(binding => {
			// in dev mode, throw if read-only values are written to
			if (readonly.has(binding.name)) {
				compiler.readonly.add(binding.value.name);
			}

			bindings[binding.name] = binding.value.name;

			// bind:online is a special case, we need to listen for two separate events
			if (binding.name === 'online') return;

			const associatedEvent = associatedEvents[binding.name];
			const property = properties[binding.name] || binding.name;

			if (!events[associatedEvent]) events[associatedEvent] = [];
			events[associatedEvent].push(
				`${binding.value.name}: this.${property}`
			);

			// add initial value
			compiler.metaBindings.push(
				`this._state.${binding.value.name} = window.${property};`
			);
		});

		const lock = block.getUniqueName(`window_updating`);
		const clear = block.getUniqueName(`clear_window_updating`);
		const timeout = block.getUniqueName(`window_updating_timeout`);

		Object.keys(events).forEach(event => {
			const handlerName = block.getUniqueName(`onwindow${event}`);
			const props = events[event].join(',\n');

			if (event === 'scroll') {
				// TODO other bidirectional bindings...
				block.addVariable(lock, 'false');
				block.addVariable(clear, `function() { ${lock} = false; }`);
				block.addVariable(timeout);
			}

			const handlerBody = deindent`
				${event === 'scroll' && deindent`
					if (${lock}) return;
					${lock} = true;
				`}
				${generator.options.dev && `component._updatingReadonlyProperty = true;`}

				#component.set({
					${props}
				});

				${generator.options.dev && `component._updatingReadonlyProperty = false;`}
				${event === 'scroll' && `${lock} = false;`}
			`;

			block.builders.init.addBlock(deindent`
				function ${handlerName}(event) {
					${handlerBody}
				}
				window.addEventListener("${event}", ${handlerName});
			`);

			block.builders.destroy.addBlock(deindent`
				window.removeEventListener("${event}", ${handlerName});
			`);
		});

		// special case... might need to abstract this out if we add more special cases
		if (bindings.scrollX || bindings.scrollY) {
			block.builders.init.addBlock(deindent`
				#component.on("state", ({ changed, current }) => {
					if (${
						[bindings.scrollX, bindings.scrollY].map(
							binding => binding && `changed["${binding}"]`
						).filter(Boolean).join(' || ')
					}) {
						${lock} = true;
						clearTimeout(${timeout});
						window.scrollTo(${
							bindings.scrollX ? `current["${bindings.scrollX}"]` : `window.pageXOffset`
						}, ${
							bindings.scrollY ? `current["${bindings.scrollY}"]` : `window.pageYOffset`
						});
						${timeout} = setTimeout(${clear}, 100);
					}
				});
			`);
		}

		// another special case. (I'm starting to think these are all special cases.)
		if (bindings.online) {
			const handlerName = block.getUniqueName(`onlinestatuschanged`);
			block.builders.init.addBlock(deindent`
				function ${handlerName}(event) {
					#component.set({ ${bindings.online}: navigator.onLine });
				}
				window.addEventListener("online", ${handlerName});
				window.addEventListener("offline", ${handlerName});
			`);

			// add initial value
			generator.metaBindings.push(
				`this._state.${bindings.online} = navigator.onLine;`
			);

			block.builders.destroy.addBlock(deindent`
				window.removeEventListener("online", ${handlerName});
				window.removeEventListener("offline", ${handlerName});
			`);
		}
	}
}
