import { walkRules } from '../utils/css';
import { Node } from '../interfaces';

export default function extractSelectors(css: Node) :Node[] {
	if (!css) return [];

	const selectors = [];

	walkRules(css.children, node => {
		node.selector.children.forEach(processSelector);
	});

	function processSelector(selector: Node) {
		// take trailing :global(...) selectors out of consideration
		let i = selector.children.length;
		while (i > 2) {
			const last = selector.children[i-1];
			const penultimate = selector.children[i-2];

			if (last.type === 'PseudoClassSelector' && last.name === 'global') {
				i -= 2;
			} else {
				break;
			}
		}

		const parts = selector.children.slice(0, i);

		selectors.push({
			used: false, // TODO use this! warn on unused selectors
			apply: (node: Node, stack: Node[]) => {
				const applies = selectorAppliesTo(parts, node, stack.slice());

				if (applies) {
					node._needsCssAttribute = true;
					if (selector.children.find(isDescendantSelector)) stack[0]._needsCssAttribute = true;
				}
			}
		});
	}

	return selectors;
}

function isDescendantSelector(selector: Node) {
	return selector.type === 'WhiteSpace'; // TODO or '>'
}

function selectorAppliesTo(parts: Node[], node: Node, stack: Node[]): boolean {
	let i = parts.length;
	let j = stack.length;

	while (i--) {
		if (!node) {
			return parts.every((part: Node) => {
				return part.type === 'Combinator' || (part.type === 'PseudoClassSelector' && part.name === 'global');
			});
		}

		const part = parts[i];

		if (part.type === 'PseudoClassSelector' && part.name === 'global') {
			// TODO shouldn't see this here... maybe we should enforce that :global(...)
			// cannot be sandwiched between non-global selectors?
			return false;
		}

		if (part.type === 'PseudoClassSelector' || part.type === 'PseudoElementSelector') {
			continue;
		}

		if (part.type === 'ClassSelector') {
			if (!attributeMatches(node, 'class', part.name, '~=', false)) return false;
		}

		else if (part.type === 'IdSelector') {
			if (!attributeMatches(node, 'id', part.name, '=', false)) return false;
		}

		else if (part.type === 'AttributeSelector') {
			if (!attributeMatches(node, part.name.name, part.value && unquote(part.value.value), part.operator, part.flags)) return false;
		}

		else if (part.type === 'TypeSelector') {
			if (part.name === '*') return true;
			if (node.name !== part.name) return false;
		}

		else if (part.type === 'WhiteSpace') {
			parts = parts.slice(0, i);

			while (stack.length) {
				if (selectorAppliesTo(parts, stack.pop(), stack)) {
					return true;
				}
			}

			return false;
		}

		else if (part.type === 'Combinator') {
			if (part.name === '>') {
				return selectorAppliesTo(parts.slice(0, i), stack.pop(), stack);
			}

			// TODO other combinators
			return true;
		}

		else {
			// bail. TODO figure out what these could be
			return true;
		}
	}

	return true;
}

const operators = {
	'=' : (value: string, flags: string) => new RegExp(`^${value}$`, flags),
	'~=': (value: string, flags: string) => new RegExp(`\\b${value}\\b`, flags),
	'|=': (value: string, flags: string) => new RegExp(`^${value}(-.+)?$`, flags),
	'^=': (value: string, flags: string) => new RegExp(`^${value}`, flags),
	'$=': (value: string, flags: string) => new RegExp(`${value}$`, flags),
	'*=': (value: string, flags: string) => new RegExp(value, flags)
};

function attributeMatches(node: Node, name: string, expectedValue: string, operator: string, caseInsensitive: boolean) {
	const attr = node.attributes.find((attr: Node) => attr.name === name);
	if (!attr) return false;
	if (attr.value === true) return operator === null;
	if (isDynamic(attr.value)) return true;

	const actualValue = attr.value[0].data;

	const pattern = operators[operator](expectedValue, caseInsensitive ? 'i' : '');
	return pattern.test(actualValue);
}

function isDynamic(value: Node) {
	return value.length > 1 || value[0].type !== 'Text';
}

function unquote(str: string) {
	if (str[0] === str[str.length - 1] && str[0] === "'" || str[0] === '"') {
		return str.slice(1, str.length - 1);
	}
}