import AwaitBlock from '../AwaitBlock';
import Comment from '../Comment';
import EachBlock from '../EachBlock';
import Element from '../Element';
import Head from '../Head';
import IfBlock from '../IfBlock';
import InlineComponent from '../InlineComponent';
import MustacheTag from '../MustacheTag';
import RawMustacheTag from '../RawMustacheTag';
import DebugTag from '../DebugTag';
import Slot from '../Slot';
import Text from '../Text';
import Title from '../Title';
import Window from '../Window';
import Node from './Node';

function getConstructor(type): typeof Node {
	switch (type) {
		case 'AwaitBlock': return AwaitBlock;
		case 'Comment': return Comment;
		case 'EachBlock': return EachBlock;
		case 'Element': return Element;
		case 'Head': return Head;
		case 'IfBlock': return IfBlock;
		case 'InlineComponent': return InlineComponent;
		case 'MustacheTag': return MustacheTag;
		case 'RawMustacheTag': return RawMustacheTag;
		case 'DebugTag': return DebugTag;
		case 'Slot': return Slot;
		case 'Text': return Text;
		case 'Title': return Title;
		case 'Window': return Window;
		default: throw new Error(`Not implemented: ${type}`);
	}
}

export default function mapChildren(component, parent, scope, children: any[]) {
	let last = null;
	return children.map(child => {
		const constructor = getConstructor(child.type);
		const node = new constructor(component, parent, scope, child);

		if (last) last.next = node;
		node.prev = last;
		last = node;

		return node;
	});
}