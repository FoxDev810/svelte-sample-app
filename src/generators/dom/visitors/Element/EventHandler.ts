import deindent from '../../../../utils/deindent';
import flattenReference from '../../../../utils/flattenReference';
import validCalleeObjects from '../../../../utils/validCalleeObjects';
import { DomGenerator } from '../../index';
import Block from '../../Block';
import { Node } from '../../../../interfaces';
import { State } from '../../interfaces';

export default function visitEventHandler(
	generator: DomGenerator,
	block: Block,
	state: State,
	node: Node,
	attribute: Node
) {
	const name = attribute.name;
	const isCustomEvent = generator.events.has(name);
	const shouldHoist = !isCustomEvent && state.inEachBlock;

	const context = shouldHoist ? null : state.parentNode;
	const usedContexts: string[] = [];

	if (attribute.expression) {
		generator.addSourcemapLocations(attribute.expression);

		const flattened = flattenReference(attribute.expression.callee);
		if (!validCalleeObjects.has(flattened.name)) {
			// allow event.stopPropagation(), this.select() etc
			// TODO verify that it's a valid callee (i.e. built-in or declared method)
			generator.code.prependRight(
				attribute.expression.start,
				`${block.alias('component')}.`
			);
			if (shouldHoist) state.usesComponent = true; // this feels a bit hacky but it works!
		}

		attribute.expression.arguments.forEach((arg: Node) => {
			const { contexts } = block.contextualise(arg, context, true);

			contexts.forEach(context => {
				if (!~usedContexts.indexOf(context)) usedContexts.push(context);
				if (!~state.allUsedContexts.indexOf(context))
					state.allUsedContexts.push(context);
			});
		});
	}

	const _this = context || 'this';
	const declarations = usedContexts.map(name => {
		if (name === 'state') {
			if (shouldHoist) state.usesComponent = true;
			return `var state = ${block.alias('component')}.get();`;
		}

		const listName = block.listNames.get(name);
		const indexName = block.indexNames.get(name);
		const contextName = block.contexts.get(name);

		return `var ${listName} = ${_this}._svelte.${listName}, ${indexName} = ${_this}._svelte.${indexName}, ${contextName} = ${listName}[${indexName}];`;
	});

	// get a name for the event handler that is globally unique
	// if hoisted, locally unique otherwise
	const handlerName = (shouldHoist ? generator : block).getUniqueName(
		`${name.replace(/[^a-zA-Z0-9_$]/g, '_')}_handler`
	);

	// create the handler body
	const handlerBody = deindent`
		${state.usesComponent &&
			`var ${block.alias('component')} = ${_this}._svelte.component;`}
		${declarations}
		${attribute.expression ?
			`[✂${attribute.expression.start}-${attribute.expression.end}✂];` :
			`${block.alias('component')}.fire("${attribute.name}", event);`}
	`;

	if (isCustomEvent) {
		block.addVariable(handlerName);

		block.builders.hydrate.addBlock(deindent`
			${handlerName} = %events-${name}.call(#component, ${state.parentNode}, function(event) {
				${handlerBody}
			});
		`);

		block.builders.destroy.addLine(deindent`
			${handlerName}.teardown();
		`);
	} else {
		const handler = deindent`
			function ${handlerName}(event) {
				${handlerBody}
			}
		`;

		if (shouldHoist) {
			generator.blocks.push(handler);
		} else {
			block.builders.init.addBlock(handler);
		}

		block.builders.hydrate.addLine(
			`@addListener(${state.parentNode}, "${name}", ${handlerName});`
		);

		block.builders.destroy.addLine(
			`@removeListener(${state.parentNode}, "${name}", ${handlerName});`
		);
	}
}
