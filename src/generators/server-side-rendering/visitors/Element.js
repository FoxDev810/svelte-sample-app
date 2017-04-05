import Component from './Component.js';
import isVoidElementName from '../../../utils/isVoidElementName.js';
import visit from '../visit.js';
import Window from './meta/Window.js';

const meta = {
	':Window': Window
};

export default {
	enter ( generator, node ) {
		if ( node.name in meta ) {
			return meta[ node.name ].enter( generator, node );
		}

		if ( generator.components.has( node.name ) || node.name === ':Self' ) {
			Component.enter( generator, node );
			return;
		}

		let openingTag = `<${node.name}`;

		node.attributes.forEach( attribute => {
			if ( attribute.type !== 'Attribute' ) return;

			let str = ` ${attribute.name}`;

			if ( attribute.value !== true ) {
				str += `="` + attribute.value.map( chunk => {
					if ( chunk.type === 'Text' ) {
						return chunk.data;
					}

					const { snippet } = generator.contextualise( chunk.expression );
					return '${' + snippet + '}';
				}).join( '' ) + `"`;
			}

			openingTag += str;
		});

		if ( generator.cssId && !generator.elementDepth ) {
			openingTag += ` ${generator.cssId}`;
		}

		openingTag += '>';

		generator.append( openingTag );

		this.elementDepth += 1;

		node.children.forEach( child => {
			visit( child, generator );
		});

		this.elementDepth -= 1;

		if ( node.name in meta ) {
			if ( meta[ node.name ].leave ) meta[ node.name ].leave( generator, node );
			return;
		}

		if ( generator.components.has( node.name ) || node.name === ':Self' ) {
			Component.leave( generator, node );
			return;
		}

		if ( !isVoidElementName( node.name ) ) {
			generator.append( `</${node.name}>` );
		}
	}
};
