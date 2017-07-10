import deindent from '../../../../utils/deindent';
import { DomGenerator } from '../../index';
import Block from '../../Block';
import { Node } from '../../../../interfaces';
import { State } from '../../interfaces';

export default function addTransitions(
	generator: DomGenerator,
	block: Block,
	state: State,
	node: Node,
	intro,
	outro
) {
	if (intro === outro) {
		const name = block.getUniqueName(`${state.name}_transition`);
		const snippet = intro.expression
			? block.contextualise(intro.expression).snippet
			: '{}';

		block.addVariable(name);

		const fn = `@template.transitions.${intro.name}`;

		block.builders.intro.addBlock(deindent`
			#component._postcreate.push( function () {
				if ( !${name} ) ${name} = @wrapTransition( #component, ${state.name}, ${fn}, ${snippet}, true, null );
				${name}.run( true, function () {
					#component.fire( 'intro.end', { node: ${state.name} });
				});
			});
		`);

		block.builders.outro.addBlock(deindent`
			${name}.run( false, function () {
				#component.fire( 'outro.end', { node: ${state.name} });
				if ( --#outros === 0 ) #outrocallback();
				${name} = null;
			});
		`);
	} else {
		const introName = intro && block.getUniqueName(`${state.name}_intro`);
		const outroName = outro && block.getUniqueName(`${state.name}_outro`);

		if (intro) {
			block.addVariable(introName);
			const snippet = intro.expression
				? block.contextualise(intro.expression).snippet
				: '{}';

			const fn = `@template.transitions.${intro.name}`; // TODO add built-in transitions?

			if (outro) {
				block.builders.intro.addBlock(deindent`
					if ( ${introName} ) ${introName}.abort();
					if ( ${outroName} ) ${outroName}.abort();
				`);
			}

			block.builders.intro.addBlock(deindent`
				#component._postcreate.push( function () {
					${introName} = @wrapTransition( #component, ${state.name}, ${fn}, ${snippet}, true, null );
					${introName}.run( true, function () {
						#component.fire( 'intro.end', { node: ${state.name} });
					});
				});
			`);
		}

		if (outro) {
			block.addVariable(outroName);
			const snippet = outro.expression
				? block.contextualise(outro.expression).snippet
				: '{}';

			const fn = `@template.transitions.${outro.name}`;

			// TODO hide elements that have outro'd (unless they belong to a still-outroing
			// group) prior to their removal from the DOM
			block.builders.outro.addBlock(deindent`
				${outroName} = @wrapTransition( #component, ${state.name}, ${fn}, ${snippet}, false, null );
				${outroName}.run( false, function () {
					#component.fire( 'outro.end', { node: ${state.name} });
					if ( --#outros === 0 ) #outrocallback();
				});
			`);
		}
	}
}
