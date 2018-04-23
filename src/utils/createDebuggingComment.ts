import { DomGenerator } from '../generators/dom/index';
import { Node } from '../interfaces';

export default function createDebuggingComment(node: Node, generator: DomGenerator) {
	return `TODO ${node.start}-${node.end}`;
	// const { locate, source } = generator;

	// let c = node.start;
	// if (node.type === 'ElseBlock') {
	// 	while (source[c - 1] !== '{') c -= 1;
	// 	while (source[c - 1] === '{') c -= 1;
	// }

	// let d = node.expression ? node.expression.end : c;
	// while (source[d] !== '}') d += 1;
	// while (source[d] === '}') d += 1;

	// const start = locate(c);
	// const loc = `(${start.line + 1}:${start.column})`;

	// return `${loc} ${source.slice(c, d)}`.replace(/\s/g, ' ');
}
