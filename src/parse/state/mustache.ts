import readExpression from '../read/expression';
import { whitespace } from '../../utils/patterns';
import { trimStart, trimEnd } from '../../utils/trim';
import reservedNames from '../../utils/reservedNames';
import { Parser } from '../index';
import { Node } from '../../interfaces';

function trimWhitespace(block: Node, trimBefore: boolean, trimAfter: boolean) {
	if (!block.children || block.children.length === 0) return; // AwaitBlock

	const firstChild = block.children[0];
	const lastChild = block.children[block.children.length - 1];

	if (firstChild.type === 'Text' && trimBefore) {
		firstChild.data = trimStart(firstChild.data);
		if (!firstChild.data) block.children.shift();
	}

	if (lastChild.type === 'Text' && trimAfter) {
		lastChild.data = trimEnd(lastChild.data);
		if (!lastChild.data) block.children.pop();
	}

	if (block.else) {
		trimWhitespace(block.else, trimBefore, trimAfter);
	}

	if (firstChild.elseif) {
		trimWhitespace(firstChild, trimBefore, trimAfter);
	}
}

export default function mustache(parser: Parser) {
	const start = parser.index;
	parser.index += parser.v2 ? 1 : 2;

	parser.allowWhitespace();

	// {{/if}} or {{/each}}
	if (parser.eat('/')) {
		let block = parser.current();
		let expected;

		if (block.type === 'ElseBlock' || block.type === 'PendingBlock' || block.type === 'ThenBlock' || block.type === 'CatchBlock') {
			block.end = start;
			parser.stack.pop();
			block = parser.current();

			expected = 'await';
		}

		if (block.type === 'IfBlock') {
			expected = 'if';
		} else if (block.type === 'EachBlock') {
			expected = 'each';
		} else if (block.type === 'AwaitBlock') {
			expected = 'await';
		} else {
			parser.error(`Unexpected block closing tag`);
		}

		parser.eat(expected, true);
		parser.allowWhitespace();
		parser.eat(parser.v2 ? '}' : '}}', true);

		while (block.elseif) {
			block.end = parser.index;
			parser.stack.pop();
			block = parser.current();

			if (block.else) {
				block.else.end = start;
			}
		}

		// strip leading/trailing whitespace as necessary
		const charBefore = parser.template[block.start - 1];
		const charAfter = parser.template[parser.index];
		const trimBefore = !charBefore || whitespace.test(charBefore);
		const trimAfter = !charAfter || whitespace.test(charAfter);

		trimWhitespace(block, trimBefore, trimAfter);

		block.end = parser.index;
		parser.stack.pop();
	} else if (parser.eat(parser.v2 ? ':elseif' : 'elseif')) {
		const block = parser.current();
		if (block.type !== 'IfBlock')
			parser.error(
				'Cannot have an {{elseif ...}} block outside an {{#if ...}} block'
			);

		parser.requireWhitespace();

		const expression = readExpression(parser);

		parser.allowWhitespace();
		parser.eat(parser.v2 ? '}' : '}}', true);

		block.else = {
			start: parser.index,
			end: null,
			type: 'ElseBlock',
			children: [
				{
					start: parser.index,
					end: null,
					type: 'IfBlock',
					elseif: true,
					expression,
					children: [],
				},
			],
		};

		parser.stack.push(block.else.children[0]);
	} else if (parser.eat(parser.v2 ? ':else' : 'else')) {
		const block = parser.current();
		if (block.type !== 'IfBlock' && block.type !== 'EachBlock') {
			parser.error(
				'Cannot have an {{else}} block outside an {{#if ...}} or {{#each ...}} block'
			);
		}

		parser.allowWhitespace();
		parser.eat(parser.v2 ? '}' : '}}', true);

		block.else = {
			start: parser.index,
			end: null,
			type: 'ElseBlock',
			children: [],
		};

		parser.stack.push(block.else);
	} else if (parser.eat(parser.v2 ? ':then' : 'then')) {
		// TODO DRY out this and the next section
		const pendingBlock = parser.current();
		if (pendingBlock.type === 'PendingBlock') {
			pendingBlock.end = start;
			parser.stack.pop();
			const awaitBlock = parser.current();

			parser.requireWhitespace();
			awaitBlock.value = parser.readIdentifier();

			parser.allowWhitespace();
			parser.eat(parser.v2 ? '}' : '}}', true);

			const thenBlock: Node = {
				start,
				end: null,
				type: 'ThenBlock',
				children: []
			};

			awaitBlock.then = thenBlock;
			parser.stack.push(thenBlock);
		}
	} else if (parser.eat(parser.v2 ? ':catch' : 'catch')) {
		const thenBlock = parser.current();
		if (thenBlock.type === 'ThenBlock') {
			thenBlock.end = start;
			parser.stack.pop();
			const awaitBlock = parser.current();

			parser.requireWhitespace();
			awaitBlock.error = parser.readIdentifier();

			parser.allowWhitespace();
			parser.eat(parser.v2 ? '}' : '}}', true);

			const catchBlock: Node = {
				start,
				end: null,
				type: 'CatchBlock',
				children: []
			};

			awaitBlock.catch = catchBlock;
			parser.stack.push(catchBlock);
		}
	} else if (parser.eat('#')) {
		// {{#if foo}} or {{#each foo}}
		let type;

		if (parser.eat('if')) {
			type = 'IfBlock';
		} else if (parser.eat('each')) {
			type = 'EachBlock';
		} else if (parser.eat('await')) {
			type = 'AwaitBlock';
		} else {
			parser.error(`Expected if, each or await`);
		}

		parser.requireWhitespace();

		const expression = readExpression(parser);

		const block: Node = type === 'AwaitBlock' ?
			{
				start,
				end: null,
				type,
				expression,
				value: null,
				error: null,
				pending: {
					start: null,
					end: null,
					type: 'PendingBlock',
					children: []
				},
				then: {
					start: null,
					end: null,
					type: 'ThenBlock',
					children: []
				},
				catch: {
					start: null,
					end: null,
					type: 'CatchBlock',
					children: []
				},
			} :
			{
				start,
				end: null,
				type,
				expression,
				children: [],
			};

		parser.allowWhitespace();

		// {{#each}} blocks must declare a context – {{#each list as item}}
		if (type === 'EachBlock') {
			parser.eat('as', true);
			parser.requireWhitespace();

			if (parser.eat('[')) {
				parser.allowWhitespace();

				block.destructuredContexts = [];

				do {
					parser.allowWhitespace();

					const destructuredContext = parser.readIdentifier();
					if (!destructuredContext) parser.error(`Expected name`);

					block.destructuredContexts.push(destructuredContext);
					parser.allowWhitespace();
				} while (parser.eat(','));

				if (!block.destructuredContexts.length) parser.error(`Expected name`);
				block.context = block.destructuredContexts.join('_');

				parser.allowWhitespace();
				parser.eat(']', true);
			} else {
				block.context = parser.readIdentifier();
				if (!block.context) parser.error(`Expected name`);
			}

			parser.allowWhitespace();

			if (parser.eat(',')) {
				parser.allowWhitespace();
				block.index = parser.readIdentifier();
				if (!block.index) parser.error(`Expected name`);
				parser.allowWhitespace();
			}

			if (parser.eat('@')) {
				block.key = parser.readIdentifier();
				if (!block.key) parser.error(`Expected name`);
				parser.allowWhitespace();
			}
		}

		let awaitBlockShorthand = type === 'AwaitBlock' && parser.eat('then');
		if (awaitBlockShorthand) {
			parser.requireWhitespace();
			block.value = parser.readIdentifier();
			parser.allowWhitespace();
		}

		parser.eat(parser.v2 ? '}' : '}}', true);

		parser.current().children.push(block);
		parser.stack.push(block);

		if (type === 'AwaitBlock') {
			const childBlock = awaitBlockShorthand ? block.then : block.pending;
			childBlock.start = parser.index;
			parser.stack.push(childBlock);
		}
	} else if (parser.eat('yield')) {
		// {{yield}}
		// TODO deprecate
		parser.allowWhitespace();

		if (parser.v2) {
			const expressionEnd = parser.index;

			parser.eat('}', true);
			parser.current().children.push({
				start,
				end: parser.index,
				type: 'MustacheTag',
				expression: {
					start: expressionEnd - 5,
					end: expressionEnd,
					type: 'Identifier',
					name: 'yield'
				}
			});
		} else {
			parser.eat('}}', true);

			parser.current().children.push({
				start,
				end: parser.index,
				type: 'Element',
				name: 'slot',
				attributes: [],
				children: []
			});
		}
	} else if (parser.eat(parser.v2 ? '@html' : '{')) {
		// {{{raw}}} mustache
		const expression = readExpression(parser);

		parser.allowWhitespace();
		parser.eat(parser.v2 ? '}' : '}}}', true);

		parser.current().children.push({
			start,
			end: parser.index,
			type: 'RawMustacheTag',
			expression,
		});
	} else {
		const expression = readExpression(parser);

		parser.allowWhitespace();
		parser.eat(parser.v2 ? '}' : '}}', true);

		parser.current().children.push({
			start,
			end: parser.index,
			type: 'MustacheTag',
			expression,
		});
	}
}
