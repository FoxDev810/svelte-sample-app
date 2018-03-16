import { Validator } from '../../';
import { Node } from '../../../interfaces';

export default function checkForAccessors(
	validator: Validator,
	properties: Node[],
	label: string
) {
	properties.forEach(prop => {
		if (prop.kind !== 'init') {
			validator.error(`${label} cannot use getters and setters`, { start: prop.start, end: prop.end });
		}
	});
}
