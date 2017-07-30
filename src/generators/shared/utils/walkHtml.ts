import { Node, Visitor } from '../../../interfaces';

export default function walkHtml(html: Node, visitors: Record<string, Visitor>) {
	function visit(node: Node) {
		const visitor = visitors[node.type];
		if (!visitor) throw new Error(`Not implemented: ${node.type}`);

		if (visitor.enter) visitor.enter(node);

		if (node.children) {
			node.children.forEach((child: Node) => {
				visit(child);
			});
		}

		if (visitor.leave) visitor.leave(node);
	}

	visit(html);
}
