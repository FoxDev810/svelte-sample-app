import MagicString from 'magic-string';
import { walk } from 'estree-walker';
import { getLocator } from 'locate-character';
import Selector from './Selector';
import getCodeFrame from '../utils/getCodeFrame';
import { Validator } from '../validate/index';
import { Node, Parsed, Warning } from '../interfaces';

class Rule {
	selectors: Selector[];
	declarations: Declaration[];
	node: Node;
	parent: Atrule;

	constructor(node: Node, parent?: Atrule) {
		this.node = node;
		this.parent = parent;
		this.selectors = node.selector.children.map((node: Node) => new Selector(node));
		this.declarations = node.block.children.map((node: Node) => new Declaration(node));
	}

	apply(node: Node, stack: Node[]) {
		this.selectors.forEach(selector => selector.apply(node, stack)); // TODO move the logic in here?
	}

	isUsed() {
		if (this.parent && this.parent.node.type === 'Atrule' && this.parent.node.name === 'keyframes') return true;
		return this.selectors.some(s => s.used);
	}

	minify(code: MagicString, cascade: boolean) {
		let c = this.node.start;
		let started = false;

		this.selectors.forEach((selector, i) => {
			if (cascade || selector.used) {
				const separator = started ? ',' : '';
				if ((selector.node.start - c) > separator.length) {
					code.overwrite(c, selector.node.start, separator);
				}

				if (!cascade) selector.minify(code);
				c = selector.node.end;

				started = true;
			}
		});

		code.remove(c, this.node.block.start);

		c = this.node.block.start + 1;
		this.declarations.forEach((declaration, i) => {
			const separator = i > 0 ? ';' : '';
			if ((declaration.node.start - c) > separator.length) {
				code.overwrite(c, declaration.node.start, separator);
			}

			declaration.minify(code);

			c = declaration.node.end;
		});

		code.remove(c, this.node.block.end - 1);
	}

	transform(code: MagicString, id: string, keyframes: Map<string, string>, cascade: boolean) {
		if (this.parent && this.parent.node.type === 'Atrule' && this.parent.node.name === 'keyframes') return true;

		const attr = `[${id}]`;

		if (cascade) {
			this.selectors.forEach(selector => {
				// TODO disable cascading (without :global(...)) in v2
				const { start, end, children } = selector.node;

				const css = code.original;
				const selectorString = css.slice(start, end);

				const firstToken = children[0];

				let transformed;

				if (firstToken.type === 'TypeSelector') {
					const insert = firstToken.end;
					const head = firstToken.name === '*' ? '' : css.slice(start, insert);
					const tail = css.slice(insert, end);

					transformed = `${head}${attr}${tail},${attr} ${selectorString}`;
				} else {
					transformed = `${attr}${selectorString},${attr} ${selectorString}`;
				}

				code.overwrite(start, end, transformed);
			});
		} else {
			this.selectors.forEach(selector => selector.transform(code, attr));
		}

		this.declarations.forEach(declaration => declaration.transform(code, keyframes));
	}

	validate(validator: Validator) {
		this.selectors.forEach(selector => {
			selector.validate(validator);
		});
	}

	warnOnUnusedSelector(handler: (selector: Selector) => void) {
		this.selectors.forEach(selector => {
			if (!selector.used) handler(selector);
		});
	}
}

class Declaration {
	node: Node;

	constructor(node: Node) {
		this.node = node;
	}

	transform(code: MagicString, keyframes: Map<string, string>) {
		const property = this.node.property.toLowerCase();
		if (property === 'animation' || property === 'animation-name') {
			this.node.value.children.forEach((block: Node) => {
				if (block.type === 'Identifier') {
					const name = block.name;
					if (keyframes.has(name)) {
						code.overwrite(block.start, block.end, keyframes.get(name));
					}
				}
			});
		}
	}

	minify(code: MagicString) {
		const c = this.node.start + this.node.property.length;
		const first = this.node.value.children  ?
			this.node.value.children[0] :
			this.node.value;

		let start = first.start;
		while (/\s/.test(code.original[start])) start += 1;

		if (start - c > 1) {
			code.overwrite(c, start, ':');
		}
	}
}

class Atrule {
	node: Node;
	children: (Atrule|Rule)[];

	constructor(node: Node) {
		this.node = node;
		this.children = [];
	}

	apply(node: Node, stack: Node[]) {
		if (this.node.name === 'media') {
			this.children.forEach(child => {
				child.apply(node, stack);
			});
		}

		else if (this.node.name === 'keyframes') {
			this.children.forEach((rule: Rule) => {
				rule.selectors.forEach(selector => {
					selector.used = true;
				});
			});
		}
	}

	isUsed() {
		return true; // TODO
	}

	minify(code: MagicString, cascade: boolean) {
		if (this.node.name === 'media') {
			const expressionChar = code.original[this.node.expression.start];
			let c = this.node.start + (expressionChar === '(' ? 6 : 7);
			if (this.node.expression.start > c) code.remove(c, this.node.expression.start);

			this.node.expression.children.forEach((query: Node) => {
				// TODO minify queries
				c = query.end;
			});

			code.remove(c, this.node.block.start);
		} else if (this.node.name === 'keyframes') {
			let c = this.node.start + 10;
			if (this.node.expression.start - c > 1) code.overwrite(c, this.node.expression.start, ' ');
			c = this.node.expression.end;
			if (this.node.block.start - c > 0) code.remove(c, this.node.block.start);
		}

		// TODO other atrules

		if (this.node.block) {
			let c = this.node.block.start + 1;

			this.children.forEach(child => {
				if (cascade || child.isUsed()) {
					code.remove(c, child.node.start);
					child.minify(code, cascade);
					c = child.node.end;
				}
			});

			code.remove(c, this.node.block.end - 1);
		}
	}

	transform(code: MagicString, id: string, keyframes: Map<string, string>, cascade: boolean) {
		if (this.node.name === 'keyframes') {
			this.node.expression.children.forEach(({ type, name, start, end }: Node) => {
				if (type === 'Identifier') {
					if (name.startsWith('-global-')) {
						code.remove(start, start + 8);
					} else {
						code.overwrite(start, end, keyframes.get(name));
					}
				}
			});
		}

		this.children.forEach(child => {
			child.transform(code, id, keyframes, cascade);
		})
	}

	validate(validator: Validator) {
		this.children.forEach(child => {
			child.validate(validator);
		});
	}

	warnOnUnusedSelector(handler: (selector: Selector) => void) {
		if (this.node.name !== 'media') return;

		this.children.forEach(child => {
			child.warnOnUnusedSelector(handler);
		});
	}
}

const keys = {};

export default class Stylesheet {
	source: string;
	parsed: Parsed;
	cascade: boolean;
	filename: string;

	hasStyles: boolean;
	id: string;

	children: (Rule|Atrule)[];
	keyframes: Map<string, string>;

	constructor(source: string, parsed: Parsed, filename: string, cascade: boolean) {
		this.source = source;
		this.parsed = parsed;
		this.cascade = cascade;
		this.filename = filename;

		this.id = `svelte-${parsed.hash}`;

		this.children = [];
		this.keyframes = new Map();

		if (parsed.css && parsed.css.children.length) {
			this.hasStyles = true;

			const stack: Atrule[] = [];
			let currentAtrule: Atrule = null;

			walk(this.parsed.css, {
				enter: (node: Node) => {
					if (node.type === 'Atrule') {
						const atrule = new Atrule(node);
						stack.push(atrule);

						if (currentAtrule) {
							currentAtrule.children.push(atrule);
						} else {
							this.children.push(atrule);
						}

						if (node.name === 'keyframes') {
							node.expression.children.forEach((expression: Node) => {
								if (expression.type === 'Identifier' && !expression.name.startsWith('-global-')) {
									this.keyframes.set(expression.name, `${this.id}-${expression.name}`);
								}
							});
						}

						currentAtrule = atrule;
					}

					if (node.type === 'Rule') {
						const rule = new Rule(node, currentAtrule);

						if (currentAtrule) {
							currentAtrule.children.push(rule);
						} else {
							this.children.push(rule);
						}
					}
				},

				leave: (node: Node) => {
					if (node.type === 'Atrule') {
						stack.pop();
						currentAtrule = stack[stack.length - 1];
					}
				}
			});
		} else {
			this.hasStyles = false;
		}
	}

	apply(node: Node, stack: Node[]) {
		if (!this.hasStyles) return;

		if (this.cascade) {
			if (stack.length === 0) node._needsCssAttribute = true;
			return;
		}

		for (let i = 0; i < this.children.length; i += 1) {
			const child = this.children[i];
			child.apply(node, stack);
		}
	}

	render(cssOutputFilename: string) {
		if (!this.hasStyles) {
			return { css: null, cssMap: null };
		}

		const code = new MagicString(this.source);

		walk(this.parsed.css, {
			enter: (node: Node) => {
				code.addSourcemapLocation(node.start);
				code.addSourcemapLocation(node.end);
			}
		});

		this.children.forEach((child: (Atrule|Rule)) => {
			child.transform(code, this.id, this.keyframes, this.cascade);
		});

		let c = 0;
		this.children.forEach(child => {
			if (this.cascade || child.isUsed()) {
				code.remove(c, child.node.start);
				child.minify(code, this.cascade);
				c = child.node.end;
			}
		});

		code.remove(c, this.source.length);

		return {
			css: code.toString(),
			cssMap: code.generateMap({
				includeContent: true,
				source: this.filename,
				file: cssOutputFilename
			})
		};
	}

	validate(validator: Validator) {
		this.children.forEach(child => {
			child.validate(validator);
		});
	}

	warnOnUnusedSelectors(onwarn: (warning: Warning) => void) {
		if (this.cascade) return;

		let locator;

		const handler = (selector: Selector) => {
			const pos = selector.node.start;

			if (!locator) locator = getLocator(this.source);
			const { line, column } = locator(pos);

			const frame = getCodeFrame(this.source, line, column);
			const message = `Unused CSS selector`;

			onwarn({
				message,
				frame,
				loc: { line: line + 1, column },
				pos,
				filename: this.filename,
				toString: () => `${message} (${line + 1}:${column})\n${frame}`,
			});
		};

		this.children.forEach(child => {
			child.warnOnUnusedSelector(handler);
		});
	}
}