import deindent from '../../../../utils/deindent';
import { DomGenerator } from '../../index';
import Block from '../../Block';
import { Node } from '../../../../interfaces';
import { State } from '../../interfaces';

export default function visitRef(
	generator: DomGenerator,
	block: Block,
	state: State,
	node: Node,
	attribute: Node
) {
	const name = attribute.name;

	block.builders.mount.addLine(
		`${block.component}.refs.${name} = ${state.parentNode};`
	);

	block.builders.unmount.addLine(deindent`
		if ( ${block.component}.refs.${name} === ${state.parentNode} ) ${block.component}.refs.${name} = null;
	`);

	generator.usesRefs = true; // so this component.refs object is created
}
