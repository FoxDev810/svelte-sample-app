import { DomGenerator } from '../index';
import Block from '../Block';
import { Node } from '../../../interfaces';
import { State } from '../interfaces';

export default function visitText(
	generator: DomGenerator,
	block: Block,
	state: State,
	node: Node
) {
	if (!node._state.shouldCreate) return;
	block.addElement(
		node._state.name,
		`@createText( ${JSON.stringify(node.data)} )`,
		generator.hydratable ? `@claimText( ${state.parentNodes}, ${JSON.stringify(node.data)} )` : '',
		state.parentNode,
		node.usedAsAnchor
	);
}
