import deindent from '../../../../../utils/deindent';
import getTailSnippet from '../../../../../utils/getTailSnippet';
import { Node } from '../../../../../interfaces';

export default function getSetter({
	block,
	name,
	snippet,
	context,
	attribute,
	dependencies,
	value,
}) {
	const tail = attribute.value.type === 'MemberExpression'
		? getTailSnippet(attribute.value)
		: '';

	if (block.contexts.has(name)) {
		const prop = dependencies[0];
		const computed = isComputed(attribute.value);

		return deindent`
			var list = this.${context}.${block.listNames.get(name)};
			var index = this.${context}.${block.indexNames.get(name)};
			${computed && `var state = #component.get();`}
			list[index]${tail} = ${value};

			${computed ?
				`#component._set({ ${dependencies.map((prop: string) => `${prop}: state.${prop}`).join(', ')} });` :
				`#component._set({ ${dependencies.map((prop: string) => `${prop}: #component.get( '${prop}' )`).join(', ')} });`
			}
		`;
	}

	if (attribute.value.type === 'MemberExpression') {
		return deindent`
			var state = #component.get();
			${snippet} = ${value};
			#component._set({ ${dependencies.map((prop: string) => `${prop}: state.${prop}`).join(', ')} });
		`;
	}

	return `#component._set({ ${name}: ${value} });`;
}

function isComputed(node: Node) {
	while (node.type === 'MemberExpression') {
		if (node.computed) return true;
		node = node.object;
	}

	return false;
}
