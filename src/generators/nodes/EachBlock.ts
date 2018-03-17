import deindent from '../../utils/deindent';
import Node from './shared/Node';
import ElseBlock from './ElseBlock';
import { DomGenerator } from '../dom/index';
import Block from '../dom/Block';
import createDebuggingComment from '../../utils/createDebuggingComment';

export default class EachBlock extends Node {
	type: 'EachBlock';

	block: Block;
	expression: Node;

	iterations: string;
	index: string;
	context: string;
	key: string;
	destructuredContexts: string[];

	children: Node[];
	else?: ElseBlock;

	init(
		block: Block,
		stripWhitespace: boolean,
		nextSibling: Node
	) {
		this.cannotUseInnerHTML();

		this.var = block.getUniqueName(`each`);
		this.iterations = block.getUniqueName(`${this.var}_blocks`);
		this.each_context = block.getUniqueName(`${this.var}_context`);

		const { dependencies } = this.metadata;
		block.addDependencies(dependencies);

		this.block = block.child({
			comment: createDebuggingComment(this, this.generator),
			name: this.generator.getUniqueName('create_each_block'),
			context: this.context,
			key: this.key,

			contexts: new Map(block.contexts),
			contextTypes: new Map(block.contextTypes),
			indexes: new Map(block.indexes),
			changeableIndexes: new Map(block.changeableIndexes),

			listName: (
				(this.expression.type === 'MemberExpression' && !this.expression.computed) ? this.expression.property.name :
				this.expression.type === 'Identifier' ? this.expression.name :
				`each_value`
			),
			indexName: this.index || `${this.context}_index`,

			indexNames: new Map(block.indexNames),
			listNames: new Map(block.listNames)
		});

		this.block.contextTypes.set(this.context, 'each');
		this.block.indexNames.set(this.context, this.block.indexName);
		this.block.listNames.set(this.context, this.block.listName);
		if (this.index) {
			this.block.indexes.set(this.index, this.context);
			this.block.changeableIndexes.set(this.index, this.key)
		}

		const context = this.block.getUniqueName(this.context);
		this.block.contexts.set(this.context, context); // TODO this is now redundant?

		if (this.destructuredContexts) {
			for (let i = 0; i < this.destructuredContexts.length; i += 1) {
				const context = this.block.getUniqueName(this.destructuredContexts[i]);
				this.block.contexts.set(this.destructuredContexts[i], context);
			}
		}

		this.contextProps = [
			`${this.block.listName}: ${this.block.listAlias}`,
			`${this.context}: ${this.block.listAlias}[#i]`,
			`${this.block.indexName}: #i`
		];

		if (this.destructuredContexts) {
			for (let i = 0; i < this.destructuredContexts.length; i += 1) {
				this.contextProps.push(`${this.destructuredContexts[i]}: ${this.block.listAlias}[#i][${i}]`);
			}
		}

		this.generator.blocks.push(this.block);
		this.initChildren(this.block, stripWhitespace, nextSibling);
		block.addDependencies(this.block.dependencies);
		this.block.hasUpdateMethod = this.block.dependencies.size > 0;

		if (this.else) {
			this.else.block = block.child({
				comment: createDebuggingComment(this.else, this.generator),
				name: this.generator.getUniqueName(`${this.block.name}_else`),
			});

			this.generator.blocks.push(this.else.block);
			this.else.initChildren(
				this.else.block,
				stripWhitespace,
				nextSibling
			);
			this.else.block.hasUpdateMethod = this.else.block.dependencies.size > 0;
		}
	}

	build(
		block: Block,
		parentNode: string,
		parentNodes: string
	) {
		const { generator } = this;

		const each = this.var;

		const create_each_block = this.block.name;
		const each_block_value = this.block.listAlias;
		const iterations = this.iterations;

		const needsAnchor = this.next ? !this.next.isDomNode() : !parentNode || !this.parent.isDomNode();
		const anchor = needsAnchor
			? block.getUniqueName(`${each}_anchor`)
			: (this.next && this.next.var) || 'null';

		// hack the sourcemap, so that if data is missing the bug
		// is easy to find
		let c = this.start + 3;
		while (generator.source[c] !== 'e') c += 1;
		generator.code.overwrite(c, c + 4, 'length');
		const length = `[✂${c}-${c+4}✂]`;

		const mountOrIntro = this.block.hasIntroMethod ? 'i' : 'm';
		const vars = {
			each,
			create_each_block,
			each_block_value,
			length,
			iterations,
			anchor,
			mountOrIntro,
		};

		block.contextualise(this.expression);
		const { snippet } = this.metadata;

		block.builders.init.addLine(`var ${each_block_value} = ${snippet};`);

		if (this.key) {
			this.buildKeyed(block, parentNode, parentNodes, snippet, vars);
		} else {
			this.buildUnkeyed(block, parentNode, parentNodes, snippet, vars);
		}

		if (needsAnchor) {
			block.addElement(
				anchor,
				`@createComment()`,
				parentNodes && `@createComment()`,
				parentNode
			);
		}

		if (this.else) {
			const each_block_else = generator.getUniqueName(`${each}_else`);

			block.builders.init.addLine(`var ${each_block_else} = null;`);

			// TODO neaten this up... will end up with an empty line in the block
			block.builders.init.addBlock(deindent`
				if (!${each_block_value}.${length}) {
					${each_block_else} = ${this.else.block.name}(#component, state);
					${each_block_else}.c();
				}
			`);

			block.builders.mount.addBlock(deindent`
				if (${each_block_else}) {
					${each_block_else}.${mountOrIntro}(${parentNode || '#target'}, null);
				}
			`);

			const initialMountNode = parentNode || `${anchor}.parentNode`;

			if (this.else.block.hasUpdateMethod) {
				block.builders.update.addBlock(deindent`
					if (!${each_block_value}.${length} && ${each_block_else}) {
						${each_block_else}.p(changed, state);
					} else if (!${each_block_value}.${length}) {
						${each_block_else} = ${this.else.block.name}(#component, state);
						${each_block_else}.c();
						${each_block_else}.${mountOrIntro}(${initialMountNode}, ${anchor});
					} else if (${each_block_else}) {
						${each_block_else}.u();
						${each_block_else}.d();
						${each_block_else} = null;
					}
				`);
			} else {
				block.builders.update.addBlock(deindent`
					if (${each_block_value}.${length}) {
						if (${each_block_else}) {
							${each_block_else}.u();
							${each_block_else}.d();
							${each_block_else} = null;
						}
					} else if (!${each_block_else}) {
						${each_block_else} = ${this.else.block.name}(#component, state);
						${each_block_else}.c();
						${each_block_else}.${mountOrIntro}(${initialMountNode}, ${anchor});
					}
				`);
			}

			block.builders.unmount.addLine(
				`if (${each_block_else}) ${each_block_else}.u()`
			);

			block.builders.destroy.addBlock(deindent`
				if (${each_block_else}) ${each_block_else}.d();
			`);
		}

		this.children.forEach((child: Node) => {
			child.build(this.block, null, 'nodes');
		});

		if (this.else) {
			this.else.children.forEach((child: Node) => {
				child.build(this.else.block, null, 'nodes');
			});
		}
	}

	buildKeyed(
		block: Block,
		parentNode: string,
		parentNodes: string,
		snippet: string,
		{
			each,
			create_each_block,
			each_block_value,
			length,
			anchor,
			mountOrIntro,
		}
	) {
		const key = block.getUniqueName('key');
		const lookup = block.getUniqueName(`${each}_lookup`);
		const iteration = block.getUniqueName(`${each}_iteration`);
		const head = block.getUniqueName(`${each}_head`);
		const last = block.getUniqueName(`${each}_last`);
		const expected = block.getUniqueName(`${each}_expected`);

		block.addVariable(lookup, `@blankObject()`);
		block.addVariable(head);
		block.addVariable(last);

		if (this.children[0].isDomNode()) {
			this.block.first = this.children[0].var;
		} else {
			this.block.first = this.block.getUniqueName('first');
			this.block.addElement(
				this.block.first,
				`@createComment()`,
				parentNodes && `@createComment()`,
				null
			);
		}

		block.builders.init.addBlock(deindent`
			for (var #i = 0; #i < ${each_block_value}.${length}; #i += 1) {
				var ${key} = ${each_block_value}[#i].${this.key};
				var ${iteration} = ${lookup}[${key}] = ${create_each_block}(#component, ${key}, @assign({}, state, {
					${this.contextProps.join(',\n')}
				}));

				if (${last}) ${last}.next = ${iteration};
				${iteration}.last = ${last};
				${last} = ${iteration};

				if (#i === 0) ${head} = ${iteration};
			}
		`);

		const initialMountNode = parentNode || '#target';
		const updateMountNode = this.getUpdateMountNode(anchor);
		const anchorNode = parentNode ? 'null' : 'anchor';

		block.builders.create.addBlock(deindent`
			var ${iteration} = ${head};
			while (${iteration}) {
				${iteration}.c();
				${iteration} = ${iteration}.next;
			}
		`);

		if (parentNodes) {
			block.builders.claim.addBlock(deindent`
				var ${iteration} = ${head};
				while (${iteration}) {
					${iteration}.l(${parentNodes});
					${iteration} = ${iteration}.next;
				}
			`);
		}

		block.builders.mount.addBlock(deindent`
			var ${iteration} = ${head};
			while (${iteration}) {
				${iteration}.${mountOrIntro}(${initialMountNode}, ${anchorNode});
				${iteration} = ${iteration}.next;
			}
		`);

		const dynamic = this.block.hasUpdateMethod;

		let destroy;
		if (this.block.hasOutroMethod) {
			const fn = block.getUniqueName(`${each}_outro`);
			block.builders.init.addBlock(deindent`
				function ${fn}(iteration) {
					iteration.o(function() {
						iteration.u();
						iteration.d();
						${lookup}[iteration.key] = null;
					});
				}
			`);

			destroy = deindent`
				while (${expected}) {
					${fn}(${expected});
					${expected} = ${expected}.next;
				}

				for (#i = 0; #i < discard_pile.length; #i += 1) {
					if (discard_pile[#i].discard) {
						${fn}(discard_pile[#i]);
					}
				}
			`;
		} else {
			const fn = block.getUniqueName(`${each}_destroy`);
			block.builders.init.addBlock(deindent`
				function ${fn}(iteration) {
					iteration.u();
					iteration.d();
					${lookup}[iteration.key] = null;
				}
			`);

			destroy = deindent`
				while (${expected}) {
					${fn}(${expected});
					${expected} = ${expected}.next;
				}

				for (#i = 0; #i < discard_pile.length; #i += 1) {
					var ${iteration} = discard_pile[#i];
					if (${iteration}.discard) {
						${fn}(${iteration});
					}
				}
			`;
		}

		block.builders.update.addBlock(deindent`
			var ${each_block_value} = ${snippet};

			var ${expected} = ${head};
			var ${last} = null;

			var rendered = {};
			var all = {};

			var each_all = ${head};
		      while(each_all) {
		        all[each_all.key] = each_all;
		        each_all = each_all.next;
		      }

			for (#i = 0; #i < ${each_block_value}.${length}; #i += 1) {
				var ${key} = ${each_block_value}[#i].${this.key};
				var ${iteration} = ${lookup}[${key}];

				var ${this.each_context} = @assign({}, state, {
					${this.contextProps.join(',\n')}
				});

				${dynamic &&
					`if (${iteration}) ${iteration}.p(changed, ${this.each_context});`}

				if (${expected}) {
					if (${key} === ${expected}.key) {
						${expected} = ${expected}.next;
					} else {
						if (${iteration}) {

						  var next_data = ${each_block_value}[#i+1];
			              var next = next_data && ${lookup}[next_data.id];
			              var first = ${iteration}.first;
			              var first_next = next && next.first;
			              ///insertNode(first, tbody, first_next);
			              ${updateMountNode}.insertBefore(first, first_next);
			              ${expected} = next;
			              ${iteration}.next = ${expected};
			              var prev_data = ${each_block_value}[#i-1];
			              var prev = prev_data && ${lookup}[prev_data.id];
			              if (prev) {
			              	prev.next = ${iteration};
			              	}

						} else {
							// key is being inserted
							${iteration} = ${lookup}[${key}] = ${create_each_block}(#component, ${key}, ${this.each_context});
							${iteration}.c();
							${iteration}.${mountOrIntro}(${updateMountNode}, ${expected}.first);

							${expected}.last = ${iteration};
							${iteration}.next = ${expected};
						}
					}
				} else {
					// we're appending from this point forward
					if (${iteration}) {
						${iteration}.next = null;
						${iteration}.m(${updateMountNode}, ${anchor});
					} else {
						${iteration} = ${lookup}[${key}] = ${create_each_block}(#component, ${key}, ${this.each_context});
						${iteration}.c();
						${iteration}.${mountOrIntro}(${updateMountNode}, ${anchor});
					}
				}
				if (${iteration}) {
		          rendered[${iteration}.key] = ${iteration};
		        }

				if (${last}) ${last}.next = ${iteration};
				${iteration}.last = ${last};
				${this.block.hasIntroMethod && `${iteration}.i(${updateMountNode}, ${anchor});`}
				${last} = ${iteration};
			}

			if (${last}) ${last}.next = null;

			for (var key_all in all) {
		        if (!rendered[key_all]) all[key_all].d();
		      }



			${head} = ${lookup}[${each_block_value}[0] && ${each_block_value}[0].${this.key}];
		`);

		if (!parentNode) {
			block.builders.unmount.addBlock(deindent`
				var ${iteration} = ${head};
				while (${iteration}) {
					${iteration}.u();
					${iteration} = ${iteration}.next;
				}
			`);
		}

		block.builders.destroy.addBlock(deindent`
			var ${iteration} = ${head};
			while (${iteration}) {
				${iteration}.d();
				${iteration} = ${iteration}.next;
			}
		`);
	}

	buildUnkeyed(
		block: Block,
		parentNode: string,
		parentNodes: string,
		snippet: string,
		{
			create_each_block,
			each_block_value,
			length,
			iterations,
			anchor,
			mountOrIntro,
		}
	) {
		block.builders.init.addBlock(deindent`
			var ${iterations} = [];

			for (var #i = 0; #i < ${each_block_value}.${length}; #i += 1) {
				${iterations}[#i] = ${create_each_block}(#component, @assign({}, state, {
					${this.contextProps.join(',\n')}
				}));
			}
		`);

		const initialMountNode = parentNode || '#target';
		const updateMountNode = this.getUpdateMountNode(anchor);
		const anchorNode = parentNode ? 'null' : 'anchor';

		block.builders.create.addBlock(deindent`
			for (var #i = 0; #i < ${iterations}.length; #i += 1) {
				${iterations}[#i].c();
			}
		`);

		if (parentNodes) {
			block.builders.claim.addBlock(deindent`
				for (var #i = 0; #i < ${iterations}.length; #i += 1) {
					${iterations}[#i].l(${parentNodes});
				}
			`);
		}

		block.builders.mount.addBlock(deindent`
			for (var #i = 0; #i < ${iterations}.length; #i += 1) {
				${iterations}[#i].${mountOrIntro}(${initialMountNode}, ${anchorNode});
			}
		`);

		const allDependencies = new Set(this.block.dependencies);
		const { dependencies } = this.metadata;
		dependencies.forEach((dependency: string) => {
			allDependencies.add(dependency);
		});

		// TODO do this for keyed blocks as well
		const condition = Array.from(allDependencies)
			.map(dependency => `changed.${dependency}`)
			.join(' || ');

		if (condition !== '') {
			const forLoopBody = this.block.hasUpdateMethod
				? this.block.hasIntroMethod
					? deindent`
						if (${iterations}[#i]) {
							${iterations}[#i].p(changed, ${this.each_context});
						} else {
							${iterations}[#i] = ${create_each_block}(#component, ${this.each_context});
							${iterations}[#i].c();
						}
						${iterations}[#i].i(${updateMountNode}, ${anchor});
					`
					: deindent`
						if (${iterations}[#i]) {
							${iterations}[#i].p(changed, ${this.each_context});
						} else {
							${iterations}[#i] = ${create_each_block}(#component, ${this.each_context});
							${iterations}[#i].c();
							${iterations}[#i].m(${updateMountNode}, ${anchor});
						}
					`
				: deindent`
					${iterations}[#i] = ${create_each_block}(#component, ${this.each_context});
					${iterations}[#i].c();
					${iterations}[#i].${mountOrIntro}(${updateMountNode}, ${anchor});
				`;

			const start = this.block.hasUpdateMethod ? '0' : `${iterations}.length`;

			const outro = block.getUniqueName('outro');
			const destroy = this.block.hasOutroMethod
				? deindent`
					function ${outro}(i) {
						if (${iterations}[i]) {
							${iterations}[i].o(function() {
								${iterations}[i].u();
								${iterations}[i].d();
								${iterations}[i] = null;
							});
						}
					}

					for (; #i < ${iterations}.length; #i += 1) ${outro}(#i);
				`
				: deindent`
					for (; #i < ${iterations}.length; #i += 1) {
						${iterations}[#i].u();
						${iterations}[#i].d();
					}
					${iterations}.length = ${each_block_value}.${length};
				`;

			block.builders.update.addBlock(deindent`
				var ${each_block_value} = ${snippet};

				if (${condition}) {
					for (var #i = ${start}; #i < ${each_block_value}.${length}; #i += 1) {
						var ${this.each_context} = @assign({}, state, {
							${this.contextProps.join(',\n')}
						});

						${forLoopBody}
					}

					${destroy}
				}
			`);
		}

		block.builders.unmount.addBlock(deindent`
			for (var #i = 0; #i < ${iterations}.length; #i += 1) {
				${iterations}[#i].u();
			}
		`);

		block.builders.destroy.addBlock(`@destroyEach(${iterations});`);
	}

	remount(name: string) {
		// TODO consider keyed blocks
		return `for (var #i = 0; #i < ${this.iterations}.length; #i += 1) ${this.iterations}[#i].m(${name}._slotted${this.generator.legacy ? `["default"]` : `.default`}, null);`;
	}
}
