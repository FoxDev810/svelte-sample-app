import map_children from './shared/map_children';
import TemplateScope from './shared/TemplateScope';
import AbstractBlock from './shared/AbstractBlock';

export default class ThenBlock extends AbstractBlock {
	scope: TemplateScope;

	constructor(component, parent, scope, info) {
		super(component, parent, scope, info);

		this.scope = scope.child();
		this.scope.add(parent.value, parent.expression.dependencies, this);
		this.children = map_children(component, parent, this.scope, info.children);

		if (!info.skip) {
			this.warn_if_empty_block();
		}
	}
}
