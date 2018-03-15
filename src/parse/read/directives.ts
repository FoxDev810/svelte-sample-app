import { parseExpressionAt } from 'acorn';
import repeat from '../../utils/repeat';
import { Parser } from '../index';

const DIRECTIVES = {
	Ref: {
		names: [ 'ref' ],
		attribute(start, end, type, name) {
			return { start, end, type, name };
		}
	},

	EventHandler: {
		names: [ 'on' ],
		allowedExpressionTypes: [ 'CallExpression' ],
	},

	Binding: {
		names: [ '', 'bind' ],
		allowedExpressionTypes: [ 'Identifier', 'MemberExpression' ],
		attribute(start, end, type, name, expression, directiveName) {
			let value;

			// :foo is shorthand for foo='{{foo}}'
			if (!directiveName) {
				const valueStart = start + 1;
				const valueEnd = start + name.length;
				type = 'Attribute';
				value = getShorthandValue(start + 1, name);
			} else {
				value = expression || {
					type: 'Identifier',
					start: start + 5,
					end,
					name,
				};
			}

			return { start, end, type, name, value };
		},
	},

	Transition: {
		names: [ 'in', 'out', 'transition' ],
		allowedExpressionTypes: [ 'ObjectExpression' ],
		attribute(start, end, type, name, expression, directiveName) {
			return {
				start, end, type, name, expression,
				intro: directiveName === 'in' || directiveName === 'transition',
				outro: directiveName === 'out' || directiveName === 'transition',
			}
		},
	},
};


const lookupByName = {};

Object.keys(DIRECTIVES).forEach(name => {
	const directive = DIRECTIVES[name];
	directive.names.forEach(type => lookupByName[type] = name);
});

function readExpression(parser: Parser, start: number, quoteMark: string|null) {
	let str = '';
	let escaped = false;

	for (let i = start; i < parser.template.length; i += 1) {
		const char = parser.template[i];

		if (quoteMark) {
			if (char === quoteMark) {
				if (escaped) {
					str += quoteMark;
				} else {
					break;
				}
			} else if (escaped) {
				str += '\\' + char;
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else {
				str += char;
			}
		} else if (/[\s\r\n\/>]/.test(char)) {
			break;
		} else {
			str += char;
		}
	}

	const expression = parseExpressionAt(repeat(' ', start) + str, start, {
		ecmaVersion: 9,
	});
	parser.index = expression.end;

	parser.allowWhitespace();
	if (quoteMark) parser.eat(quoteMark, true);

	return expression;
}

export function readDirective(
	parser: Parser,
	start: number,
	attrName: string
) {
	const [ directiveName, name ] = attrName.split(':');
	if (name === undefined) return; // No colon in the name
	
	const type = lookupByName[directiveName];
	if (!type) return; // not a registered directive
	
	const directive = DIRECTIVES[type];
	let expression = null;

	if (parser.eat('=')) {
		const quoteMark = parser.eat(`'`) ? `'` : parser.eat(`"`) ? `"` : null;

		const expressionStart = parser.index;

		if (parser.eat('{{')) {
			let message = 'directive values should not be wrapped';
			const expressionEnd = parser.template.indexOf('}}', expressionStart);
			if (expressionEnd !== -1) {
				const value = parser.template.slice(parser.index, expressionEnd);
				message += ` — use '${value}', not '{{${value}}}'`;
			}

			parser.error(message, expressionStart);
		}

		expression = readExpression(parser, expressionStart, quoteMark);
		if (directive.allowedExpressionTypes.indexOf(expression.type) === -1) {
			parser.error(`Expected ${directive.allowedExpressionTypes.join(' or ')}`, expressionStart);
		}
	}

	if (directive.attribute) {
		return directive.attribute(start, parser.index, type, name, expression, directiveName);
	} else {
		return {
			start,
			end: parser.index,
			type: type,
			name,
			expression,
		};
	}
}


function getShorthandValue(start: number, name: string) {
	const end = start + name.length;

	return [
		{
			type: 'AttributeShorthand',
			start,
			end,
			expression: {
				type: 'Identifier',
				start,
				end,
				name,
			},
		},
	];
}
