import propValidators from './propValidators/index';
import fuzzymatch from '../utils/fuzzymatch';
import checkForDupes from './utils/checkForDupes';
import checkForComputedKeys from './utils/checkForComputedKeys';
import namespaces from '../../utils/namespaces';
import getName from '../../utils/getName';
import { Validator } from '../';
import { Node } from '../../interfaces';

const validPropList = Object.keys(propValidators);

export default function validateJs(validator: Validator, js: Node) {
	js.content.body.forEach((node: Node) => {
		// check there are no named exports
		if (node.type === 'ExportNamedDeclaration') {
			validator.error(`A component can only have a default export`, { start: node.start, end: node.start });
		}

		if (node.type === 'ExportDefaultDeclaration') {
			if (node.declaration.type !== 'ObjectExpression') {
				return validator.error(
					`Default export must be an object literal`,
					{ start: node.declaration.start, end: node.declaration.end }
				);
			}

			checkForComputedKeys(validator, node.declaration.properties);
			checkForDupes(validator, node.declaration.properties);

			const props = validator.properties;

			node.declaration.properties.forEach((prop: Node) => {
				props.set(getName(prop.key), prop);
			});

			// Remove these checks in version 2
			if (props.has('oncreate') && props.has('onrender')) {
				const onrender = props.get('onrender');
				validator.error(
					'Cannot have both oncreate and onrender',
					{ start: onrender.start, end: onrender.end }
				);
			}

			if (props.has('ondestroy') && props.has('onteardown')) {
				const onteardown = props.get('onteardown');
				validator.error(
					'Cannot have both ondestroy and onteardown',
					{ start: onteardown.start, end: onteardown.end }
				);
			}

			// ensure all exported props are valid
			node.declaration.properties.forEach((prop: Node) => {
				const name = getName(prop.key);
				const propValidator = propValidators[name];

				if (propValidator) {
					propValidator(validator, prop);
				} else {
					const match = fuzzymatch(name, validPropList);
					if (match) {
						validator.error(
							`Unexpected property '${name}' (did you mean '${match}'?)`,
							{ start: prop.start, end: prop.end }
						);
					} else if (/FunctionExpression/.test(prop.value.type)) {
						validator.error(
							`Unexpected property '${name}' (did you mean to include it in 'methods'?)`,
							{ start: prop.start, end: prop.end }
						);
					} else {
						validator.error(
							`Unexpected property '${name}'`,
							{ start: prop.start, end: prop.end }
						);
					}
				}
			});

			if (props.has('namespace')) {
				const ns = props.get('namespace').value.value;
				validator.namespace = namespaces[ns] || ns;
			}

			validator.defaultExport = node;
		}
	});

	['components', 'methods', 'helpers', 'transitions'].forEach(key => {
		if (validator.properties.has(key)) {
			validator.properties.get(key).value.properties.forEach((prop: Node) => {
				validator[key].set(getName(prop.key), prop.value);
			});
		}
	});
}
