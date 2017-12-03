import deindent from '../../../../utils/deindent';
import { DomGenerator } from '../../index';
import Block from '../../Block';
import { Node } from '../../../../interfaces';
import { State } from '../../interfaces';

export default function addTransitions(
	generator: DomGenerator,
	block: Block,
	state: State,
	node: Node
) {
	const intro = node.attributes.find((a: Node) => a.type === 'Transition' && a.intro);
	const outro = node.attributes.find((a: Node) => a.type === 'Transition' && a.outro);

	if (!intro && !outro) return;

	if (intro === outro) {
		block.contextualise(intro.expression); // TODO remove all these

		const name = block.getUniqueName(`${node.var}_transition`);
		const snippet = intro.expression
			? intro.metadata.snippet
			: '{}';

		block.addVariable(name);

		const fn = `%transitions-${intro.name}`;

		block.builders.intro.addBlock(deindent`
			#component._root._aftercreate.push(function() {
				if (!${name}) ${name} = @wrapTransition(#component, ${node.var}, ${fn}, ${snippet}, true, null);
				${name}.run(true, function() {
					#component.fire("intro.end", { node: ${node.var} });
				});
			});
		`);

		block.builders.outro.addBlock(deindent`
			${name}.run(false, function() {
				#component.fire("outro.end", { node: ${node.var} });
				if (--#outros === 0) #outrocallback();
				${name} = null;
			});
		`);
	} else {
		const introName = intro && block.getUniqueName(`${node.var}_intro`);
		const outroName = outro && block.getUniqueName(`${node.var}_outro`);

		if (intro) {
			block.contextualise(intro.expression);

			block.addVariable(introName);
			const snippet = intro.expression
				? intro.metadata.snippet
				: '{}';

			const fn = `%transitions-${intro.name}`; // TODO add built-in transitions?

			if (outro) {
				block.builders.intro.addBlock(deindent`
					if (${introName}) ${introName}.abort();
					if (${outroName}) ${outroName}.abort();
				`);
			}

			block.builders.intro.addBlock(deindent`
				#component._root._aftercreate.push(function() {
					${introName} = @wrapTransition(#component, ${node.var}, ${fn}, ${snippet}, true, null);
					${introName}.run(true, function() {
						#component.fire("intro.end", { node: ${node.var} });
					});
				});
			`);
		}

		if (outro) {
			block.contextualise(outro.expression);

			block.addVariable(outroName);
			const snippet = outro.expression
				? outro.metadata.snippet
				: '{}';

			const fn = `%transitions-${outro.name}`;

			// TODO hide elements that have outro'd (unless they belong to a still-outroing
			// group) prior to their removal from the DOM
			block.builders.outro.addBlock(deindent`
				${outroName} = @wrapTransition(#component, ${node.var}, ${fn}, ${snippet}, false, null);
				${outroName}.run(false, function() {
					#component.fire("outro.end", { node: ${node.var} });
					if (--#outros === 0) #outrocallback();
				});
			`);
		}
	}
}
