import Block from '../../render-dom/Block';
import Component from './../../Component';
import Node from './Node';

export default class AbstractBlock extends Node {
	block: Block;
	children: Node[];

	constructor(component: Component, parent, scope, info: any) {
		super(component, parent, scope, info);
	}

	warn_if_empty_block() {
		if (!this.children || this.children.length > 1) return;

		const child = this.children[0];

		if (!child || (child.type === 'Text' && !/[^ \r\n\f\v\t]/.test(child.data))) {
			this.component.warn(this, {
				code: 'empty-block',
				message: 'Empty block'
			});
		}
	}
}
