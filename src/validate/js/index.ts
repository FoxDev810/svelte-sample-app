import propValidators from './propValidators/index';
import fuzzymatch from '../utils/fuzzymatch';
import checkForDupes from './utils/checkForDupes';
import checkForComputedKeys from './utils/checkForComputedKeys';
import namespaces from '../../utils/namespaces';
import nodeToString from '../../utils/nodeToString';
import getName from '../../utils/getName';
import { Validator } from '../';
import { Node } from '../../interfaces';

const validPropList = Object.keys(propValidators);

export default function validateJs(validator: Validator, js: Node) {
	js.content.body.forEach((node: Node) => {
		// check there are no named exports
		if (node.type === 'ExportNamedDeclaration') {
			validator.error(node, {
				code: `named-export`,
				message: `A component can only have a default export`
			});
		}

		if (node.type === 'ExportDefaultDeclaration') {
			if (node.declaration.type !== 'ObjectExpression') {
				validator.error(node.declaration, {
					code: `invalid-default-export`,
					message: `Default export must be an object literal`
				});
			}

			checkForComputedKeys(validator, node.declaration.properties);
			checkForDupes(validator, node.declaration.properties);

			const props = validator.properties;

			node.declaration.properties.forEach((prop: Node) => {
				props.set(getName(prop.key), prop);
			});

			// Remove these checks in version 2
			if (props.has('oncreate') && props.has('onrender')) {
				validator.error(props.get('onrender'), {
					code: `duplicate-oncreate`,
					message: 'Cannot have both oncreate and onrender'
				});
			}

			if (props.has('ondestroy') && props.has('onteardown')) {
				validator.error(props.get('onteardown'), {
					code: `duplicate-ondestroy`,
					message: 'Cannot have both ondestroy and onteardown'
				});
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
						validator.error(prop, {
							code: `unexpected-property`,
							message: `Unexpected property '${name}' (did you mean '${match}'?)`
						});
					} else if (/FunctionExpression/.test(prop.value.type)) {
						validator.error(prop, {
							code: `unexpected-property`,
							message: `Unexpected property '${name}' (did you mean to include it in 'methods'?)`
						});
					} else {
						validator.error(prop, {
							code: `unexpected-property`,
							message: `Unexpected property '${name}'`
						});
					}
				}
			});

			if (props.has('namespace')) {
				const ns = nodeToString(props.get('namespace').value);
				validator.namespace = namespaces[ns] || ns;
			}

			validator.defaultExport = node;
		}
	});

	['components', 'methods', 'helpers', 'transitions', 'animations', 'actions'].forEach(key => {
		if (validator.properties.has(key)) {
			validator.properties.get(key).value.properties.forEach((prop: Node) => {
				validator[key].set(getName(prop.key), prop.value);
			});
		}
	});
}
