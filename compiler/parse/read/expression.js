import { parseExpressionAt } from 'acorn';

export default function readExpression ( parser ) {
	const node = parseExpressionAt( parser.template, parser.index );
	parser.index = node.end;

	// TODO check it's a valid expression. probably shouldn't have
	// [arrow] function expressions, etc

	return node;
}
