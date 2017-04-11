import deindent from '../../../../utils/deindent.js';
import CodeBuilder from '../../../../utils/CodeBuilder.js';
import flattenReference from '../../../../utils/flattenReference.js';

export default function visitEventHandler ( generator, block, state, node, attribute ) {
	const name = attribute.name;
	const isCustomEvent = generator.events.has( name );
	const shouldHoist = !isCustomEvent && state.inEachBlock;

	generator.addSourcemapLocations( attribute.expression );

	const flattened = flattenReference( attribute.expression.callee );
	if ( flattened.name !== 'event' && flattened.name !== 'this' ) {
		// allow event.stopPropagation(), this.select() etc
		// TODO verify that it's a valid callee (i.e. built-in or declared method)
		generator.code.prependRight( attribute.expression.start, `${block.component}.` );
		if ( shouldHoist ) state.usesComponent = true; // this feels a bit hacky but it works!
	}

	const context = shouldHoist ? null : state.parentNode;
	const usedContexts = [];
	attribute.expression.arguments.forEach( arg => {
		const { contexts } = block.contextualise( arg, context, true );

		contexts.forEach( context => {
			if ( !~usedContexts.indexOf( context ) ) usedContexts.push( context );
			if ( !~state.allUsedContexts.indexOf( context ) ) state.allUsedContexts.push( context );
		});
	});

	const _this = context || 'this';
	const declarations = usedContexts.map( name => {
		if ( name === 'root' ) {
			if ( shouldHoist ) state.usesComponent = true;
			return `var root = ${block.component}.get();`;
		}

		const listName = block.listNames.get( name );
		const indexName = block.indexNames.get( name );

		return `var ${listName} = ${_this}._svelte.${listName}, ${indexName} = ${_this}._svelte.${indexName}, ${name} = ${listName}[${indexName}];`;
	});

	// get a name for the event handler that is globally unique
	// if hoisted, locally unique otherwise
	const handlerName = shouldHoist ?
		generator.alias( `${name}_handler` ) :
		block.getUniqueName( `${name}_handler` );

	// create the handler body
	const handlerBody = new CodeBuilder();

	if ( state.usesComponent ) {
		// TODO the element needs to know to create `thing._svelte = { component: component }`
		handlerBody.addLine( `var ${block.component} = this._svelte.component;` );
	}

	declarations.forEach( declaration => {
		handlerBody.addLine( declaration );
	});

	handlerBody.addLine( `[✂${attribute.expression.start}-${attribute.expression.end}✂];` );

	const handler = isCustomEvent ?
		deindent`
			var ${handlerName} = ${generator.alias( 'template' )}.events.${name}.call( ${block.component}, ${state.parentNode}, function ( event ) {
				${handlerBody}
			});
		` :
		deindent`
			function ${handlerName} ( event ) {
				${handlerBody}
			}
		`;

	if ( shouldHoist ) {
		generator.addBlock({
			render: () => handler
		});
	} else {
		block.builders.create.addBlock( handler );
	}

	if ( isCustomEvent ) {
		block.builders.destroy.addLine( deindent`
			${handlerName}.teardown();
		` );
	} else {
		block.builders.create.addLine( deindent`
			${generator.helper( 'addEventListener' )}( ${state.parentNode}, '${name}', ${handlerName} );
		` );

		block.builders.destroy.addLine( deindent`
			${generator.helper( 'removeEventListener' )}( ${state.parentNode}, '${name}', ${handlerName} );
		` );
	}
}