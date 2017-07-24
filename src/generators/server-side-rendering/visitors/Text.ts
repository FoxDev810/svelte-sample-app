import { SsrGenerator } from '../index';
import Block from '../Block';
import { Node } from '../../../interfaces';

export default function visitText(
	generator: SsrGenerator,
	block: Block,
	node: Node
) {
	generator.append(node.data.replace(/(\${|`|\\)/g, '\\$1').replace(/([^\\@#])?([@#])/g, '$1\\$2'));
}
