import * as namespaces from '../../../utils/namespaces';
import fuzzymatch from '../../utils/fuzzymatch';
import { Validator } from '../../';
import { Node } from '../../../interfaces';

const valid = new Set(namespaces.validNamespaces);

export default function namespace(validator: Validator, prop: Node) {
	const ns = prop.value.value;

	if (prop.value.type !== 'Literal' || typeof ns !== 'string') {
		validator.error(
			`The 'namespace' property must be a string literal representing a valid namespace`,
			{ start: prop.start, end: prop.end }
		);
	}

	if (!valid.has(ns)) {
		const match = fuzzymatch(ns, namespaces.validNamespaces);
		if (match) {
			validator.error(
				`Invalid namespace '${ns}' (did you mean '${match}'?)`,
				{ start: prop.start, end: prop.end }
			);
		} else {
			validator.error(`Invalid namespace '${ns}'`, { start: prop.start, end: prop.end });
		}
	}
}
