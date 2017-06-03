import checkForDupes from '../utils/checkForDupes';
import checkForComputedKeys from '../utils/checkForComputedKeys';
import { Validator } from '../../';
import { Node } from '../../../interfaces';

export default function components(validator: Validator, prop: Node) {
	if (prop.value.type !== 'ObjectExpression') {
		validator.error(
			`The 'components' property must be an object literal`,
			prop.start
		);
		return;
	}

	checkForDupes(validator, prop.value.properties);
	checkForComputedKeys(validator, prop.value.properties);

	prop.value.properties.forEach((component: Node) => {
		if (component.key.name === 'state') {
			validator.error(
				`Component constructors cannot be called 'state' due to technical limitations`,
				component.start
			);
		}

		if (!/^[A-Z]/.test(component.key.name)) {
			validator.warn(`Component names should be capitalised`, component.start);
		}
	});
}
