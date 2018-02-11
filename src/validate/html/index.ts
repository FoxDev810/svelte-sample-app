import validateElement from './validateElement';
import validateWindow from './validateWindow';
import validateHead from './validateHead';
import a11y from './a11y';
import fuzzymatch from '../utils/fuzzymatch'
import flattenReference from '../../utils/flattenReference';
import { Validator } from '../index';
import { Node } from '../../interfaces';

const meta = new Map([
	[':Window', validateWindow],
	[':Head', validateHead]
]);

function isEmptyBlock(node: Node) {
	if (!/Block$/.test(node.type) || !node.children) return false;
	if (node.children.length > 1) return false;
	const child = node.children[0];
	return !child || (child.type === 'Text' && !/\S/.test(child.data));
}

export default function validateHtml(validator: Validator, html: Node) {
	const refs = new Map();
	const refCallees: Node[] = [];
	const stack: Node[] = [];
	const elementStack: Node[] = [];

	function visit(node: Node) {
		if (node.type === 'Element') {
			if (meta.has(node.name)) {
				return meta.get(node.name)(validator, node, refs, refCallees);
			}

			const isComponent =
				node.name === ':Self' ||
				node.name === ':Component' ||
				validator.components.has(node.name);

			validateElement(
				validator,
				node,
				refs,
				refCallees,
				stack,
				elementStack,
				isComponent
			);

			if (!isComponent) {
				a11y(validator, node, elementStack);
			}
		} else if (node.type === 'EachBlock') {
			if (validator.helpers.has(node.context)) {
				let c = node.expression.end;

				// find start of context
				while (/\s/.test(validator.source[c])) c += 1;
				c += 2;
				while (/\s/.test(validator.source[c])) c += 1;

				validator.warn(
					`Context clashes with a helper. Rename one or the other to eliminate any ambiguity`,
					c
				);
			}
		}

		if (validator.options.dev && isEmptyBlock(node)) {
			validator.warn('Empty block', node.start);
		}

		if (node.children) {
			if (node.type === 'Element') elementStack.push(node);
			stack.push(node);
			node.children.forEach(visit);
			stack.pop();
			if (node.type === 'Element') elementStack.pop();
		}

		if (node.else) {
			visit(node.else);
		}

		if (node.type === 'AwaitBlock') {
			visit(node.pending);
			visit(node.then);
			visit(node.catch);
		}
	}

	html.children.forEach(visit);

	refCallees.forEach(callee => {
		const { parts } = flattenReference(callee);
		const ref = parts[1];

		if (refs.has(ref)) {
			// TODO check method is valid, e.g. `audio.stop()` should be `audio.pause()`
		} else {
			const match = fuzzymatch(ref, Array.from(refs.keys()));

			let message = `'refs.${ref}' does not exist`;
			if (match) message += ` (did you mean 'refs.${match}'?)`;

			validator.error(message, callee.start);
		}
	});
}
