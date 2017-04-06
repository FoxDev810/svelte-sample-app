import deindent from '../../../utils/deindent.js';
import findBlock from '../utils/findBlock.js';

export default function visitRawMustacheTag ( generator, node ) {
	const name = generator.current.getUniqueName( 'raw' );

	const { snippet } = generator.contextualise( node.expression );

	// we would have used comments here, but the `insertAdjacentHTML` api only
	// exists for `Element`s.
	const before = `${name}_before`;
	generator.addElement( before, `${generator.helper( 'createElement' )}( 'noscript' )`, true );

	const after = `${name}_after`;
	generator.addElement( after, `${generator.helper( 'createElement' )}( 'noscript' )`, true );

	const isToplevel = generator.current.localElementDepth === 0;

	generator.current.builders.create.addLine( `var last_${name} = ${snippet};` );
	const mountStatement = `${before}.insertAdjacentHTML( 'afterend', last_${name} );`;
	const detachStatement = `${generator.helper( 'detachBetween' )}( ${before}, ${after} );`;

	if ( isToplevel ) {
		generator.current.builders.mount.addLine( mountStatement );
	} else {
		generator.current.builders.create.addLine( mountStatement );
	}

	const fragment = findBlock( generator.current );
	if ( !fragment.tmp ) fragment.tmp = fragment.getUniqueName( 'tmp' );

	generator.current.builders.update.addBlock( deindent`
		if ( ( ${fragment.tmp} = ${snippet} ) !== last_${name} ) {
			last_${name} = ${fragment.tmp};
			${detachStatement}
			${mountStatement}
		}
	` );

	generator.current.builders.detachRaw.addBlock( detachStatement );
}