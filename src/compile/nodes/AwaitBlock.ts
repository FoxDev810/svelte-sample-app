import deindent from '../../utils/deindent';
import Node from './shared/Node';
import Block from '../dom/Block';
import PendingBlock from './PendingBlock';
import ThenBlock from './ThenBlock';
import CatchBlock from './CatchBlock';
import createDebuggingComment from '../../utils/createDebuggingComment';
import Expression from './shared/Expression';
import { SsrTarget } from '../ssr';

export default class AwaitBlock extends Node {
	expression: Expression;
	value: string;
	error: string;

	pending: PendingBlock;
	then: ThenBlock;
	catch: CatchBlock;

	constructor(compiler, parent, scope, info) {
		super(compiler, parent, scope, info);

		this.expression = new Expression(compiler, this, scope, info.expression);
		const deps = this.expression.dependencies;

		this.value = info.value;
		this.error = info.error;

		this.pending = new PendingBlock(compiler, this, scope, info.pending);
		this.then = new ThenBlock(compiler, this, scope.add(this.value, deps), info.then);
		this.catch = new CatchBlock(compiler, this, scope.add(this.error, deps), info.catch);
	}

	init(
		block: Block,
		stripWhitespace: boolean,
		nextSibling: Node
	) {
		this.cannotUseInnerHTML();

		this.var = block.getUniqueName('await_block');
		block.addDependencies(this.expression.dependencies);

		let isDynamic = false;
		let hasIntros = false;
		let hasOutros = false;

		['pending', 'then', 'catch'].forEach(status => {
			const child = this[status];

			child.block = block.child({
				comment: createDebuggingComment(child, this.compiler),
				name: this.compiler.getUniqueName(`create_${status}_block`)
			});

			child.initChildren(child.block, stripWhitespace, nextSibling);
			this.compiler.target.blocks.push(child.block);

			if (child.block.dependencies.size > 0) {
				isDynamic = true;
				block.addDependencies(child.block.dependencies);
			}

			if (child.block.hasIntroMethod) hasIntros = true;
			if (child.block.hasOutroMethod) hasOutros = true;
		});

		this.pending.block.hasUpdateMethod = isDynamic;
		this.then.block.hasUpdateMethod = isDynamic;
		this.catch.block.hasUpdateMethod = isDynamic;

		this.pending.block.hasIntroMethod = hasIntros;
		this.then.block.hasIntroMethod = hasIntros;
		this.catch.block.hasIntroMethod = hasIntros;

		this.pending.block.hasOutroMethod = hasOutros;
		this.then.block.hasOutroMethod = hasOutros;
		this.catch.block.hasOutroMethod = hasOutros;

		if (hasOutros) block.addOutro();
	}

	build(
		block: Block,
		parentNode: string,
		parentNodes: string
	) {
		const name = this.var;

		const anchor = this.getOrCreateAnchor(block, parentNode, parentNodes);
		const updateMountNode = this.getUpdateMountNode(anchor);

		const { snippet } = this.expression;

		const info = block.getUniqueName(`info`);
		const promise = block.getUniqueName(`promise`);

		block.addVariable(promise);

		block.maintainContext = true;

		const infoProps = [
			block.alias('component') === 'component' ? 'component' : `component: #component`,
			'ctx',
			'current: null',
			this.pending.block.name && `pending: ${this.pending.block.name}`,
			this.then.block.name && `then: ${this.then.block.name}`,
			this.catch.block.name && `catch: ${this.catch.block.name}`,
			this.then.block.name && `value: '${this.value}'`,
			this.catch.block.name && `error: '${this.error}'`,
			this.pending.block.hasOutroMethod && `blocks: Array(3)`
		].filter(Boolean);

		block.builders.init.addBlock(deindent`
			let ${info} = {
				${infoProps.join(',\n')}
			};
		`);

		block.builders.init.addBlock(deindent`
			@handlePromise(${promise} = ${snippet}, ${info});
		`);

		block.builders.create.addBlock(deindent`
			${info}.block.c();
		`);

		if (parentNodes) {
			block.builders.claim.addBlock(deindent`
				${info}.block.l(${parentNodes});
			`);
		}

		const initialMountNode = parentNode || '#target';
		const anchorNode = parentNode ? 'null' : 'anchor';

		const hasTransitions = this.pending.block.hasIntroMethod || this.pending.block.hasOutroMethod;

		block.builders.mount.addBlock(deindent`
			${info}.block.${hasTransitions ? 'i' : 'm'}(${initialMountNode}, ${info}.anchor = ${anchorNode});
			${info}.mount = () => ${updateMountNode};
		`);

		const conditions = [];
		if (this.expression.dependencies.size > 0) {
			conditions.push(
				`(${[...this.expression.dependencies].map(dep => `'${dep}' in changed`).join(' || ')})`
			);
		}

		conditions.push(
			`${promise} !== (${promise} = ${snippet})`,
			`@handlePromise(${promise}, ${info})`
		);

		block.builders.update.addLine(
			`${info}.ctx = ctx;`
		);

		if (this.pending.block.hasUpdateMethod) {
			block.builders.update.addBlock(deindent`
				if (${conditions.join(' && ')}) {
					// nothing
				} else {
					${info}.block.p(changed, @assign(@assign({}, ctx), ${info}.resolved));
				}
			`);
		} else {
			block.builders.update.addBlock(deindent`
				${conditions.join(' && ')}
			`);
		}

		if (this.pending.block.hasOutroMethod) {
			block.builders.outro.addBlock(deindent`
				#outrocallback = @callAfter(#outrocallback, 3);
				for (let #i = 0; #i < 3; #i += 1) {
					const block = ${info}.blocks[#i];
					if (block) block.o(#outrocallback);
					else #outrocallback();
				}
			`);
		}

		block.builders.destroy.addBlock(deindent`
			${info}.block.d(${parentNode ? '' : 'detach'});
			${info} = null;
		`);

		[this.pending, this.then, this.catch].forEach(status => {
			status.children.forEach(child => {
				child.build(status.block, null, 'nodes');
			});
		});
	}

	ssr() {
		const target: SsrTarget = <SsrTarget>this.compiler.target;
		const { snippet } = this.expression;

		target.append('${(function(__value) { if(@isPromise(__value)) return `');

		this.pending.children.forEach((child: Node) => {
			child.ssr();
		});

		target.append('`; return function(ctx) { return `');

		this.then.children.forEach((child: Node) => {
			child.ssr();
		});

		target.append(`\`;}(Object.assign({}, ctx, { ${this.value}: __value }));}(${snippet})) }`);
	}
}
