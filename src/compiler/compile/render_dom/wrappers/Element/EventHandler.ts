import EventHandler from '../../../nodes/EventHandler';
import Wrapper from '../shared/Wrapper';
import Block from '../../Block';
import { b, x, p } from 'code-red';

const TRUE = x`true`;
const FALSE = x`false`;

export default class EventHandlerWrapper {
	node: EventHandler;
	parent: Wrapper;

	constructor(node: EventHandler, parent: Wrapper) {
		this.node = node;
		this.parent = parent;

		if (!node.expression) {
			this.parent.renderer.component.add_var({
				name: node.handler_name.name,
				internal: true,
				referenced: true,
			});

			this.parent.renderer.component.partly_hoisted.push(b`
        function ${node.handler_name.name}(event) {
          @bubble($$self, event);
        }
      `);
		}
	}

  get_snippet(block) {
		const snippet = this.node.expression ? this.node.expression.manipulate(block) : x`#ctx.${this.node.handler_name}`;

		if (this.node.reassigned) {
			block.maintain_context = true;
			return x`function () { ${snippet}.apply(this, arguments); }`;
		}
		return snippet;
  }

	render(block: Block, target: string) {
		let snippet = this.get_snippet(block);

    if (this.node.modifiers.has('preventDefault')) snippet = x`@prevent_default(${snippet})`;
		if (this.node.modifiers.has('stopPropagation')) snippet = x`@stop_propagation(${snippet})`;
		if (this.node.modifiers.has('self')) snippet = x`@self(${snippet})`;
    
    const args = [];

    const opts = ['passive', 'once', 'capture'].filter(mod => this.node.modifiers.has(mod));
		if (opts.length) {
			args.push((opts.length === 1 && opts[0] === 'capture')
				? TRUE
				: x`{ ${opts.map(opt => p`${opt}: true`)} }`);
		} else if (block.renderer.options.dev) {
			args.push(FALSE);
		}

		if (block.renderer.options.dev) {
			args.push(this.node.modifiers.has('stopPropagation') ? TRUE : FALSE);
			args.push(this.node.modifiers.has('preventDefault') ? TRUE : FALSE);
		}

    block.event_listeners.push(
			x`@listen(${target}, "${this.node.name}", ${snippet}, ${args})`
		);
	}
}
