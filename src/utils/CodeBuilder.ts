import repeat from './repeat';

enum ChunkType {
	Line,
	Block
}

export default class CodeBuilder {
	result: string;
	first: ChunkType;
	last: ChunkType;
	lastCondition: string;
	conditionStack: string[];
	indent: string;

	constructor(str = '') {
		this.result = str;

		const initial = str
			? /\n/.test(str) ? ChunkType.Block : ChunkType.Line
			: null;
		this.first = initial;
		this.last = initial;

		this.lastCondition = null;
		this.conditionStack = [];
		this.indent = '';
	}

	addConditional(condition: string, body: string) {
		body = body.replace(/^/gm, `${this.indent}\t`);

		if (condition === this.lastCondition) {
			this.result += `\n${body}`;
		} else {
			if (this.lastCondition) {
				this.result += `\n${this.indent}}`;
			}

			this.result += `${this.last === ChunkType.Block ? '\n\n' : '\n'}${this.indent}if ( ${condition} ) {\n${body}`;
			this.lastCondition = condition;
		}

		this.last = ChunkType.Block;
	}

	addLine(line: string) {
		if (this.lastCondition) {
			this.result += `\n${this.indent}}`;
			this.lastCondition = null;
		}

		if (this.last === ChunkType.Block) {
			this.result += `\n\n${this.indent}${line}`;
		} else if (this.last === ChunkType.Line) {
			this.result += `\n${this.indent}${line}`;
		} else {
			this.result += line;
		}

		this.last = ChunkType.Line;
		if (!this.first) this.first = ChunkType.Line;
	}

	addLineAtStart(line: string) {
		if (this.first === ChunkType.Block) {
			this.result = `${line}\n\n${this.indent}${this.result}`;
		} else if (this.first === ChunkType.Line) {
			this.result = `${line}\n${this.indent}${this.result}`;
		} else {
			this.result += line;
		}

		this.first = ChunkType.Line;
		if (!this.last) this.last = ChunkType.Line;
	}

	addBlock(block: string) {
		if (this.indent) block = block.replace(/^/gm, `${this.indent}`);

		if (this.lastCondition) {
			this.result += `\n${this.indent}}`;
			this.lastCondition = null;
		}

		if (this.result) {
			this.result += `\n\n${this.indent}${block}`;
		} else {
			this.result += block;
		}

		this.last = ChunkType.Block;
		if (!this.first) this.first = ChunkType.Block;
	}

	addBlockAtStart(block: string) {
		if (this.result) {
			this.result = `${block}\n\n${this.indent}${this.result}`;
		} else {
			this.result += block;
		}

		this.first = ChunkType.Block;
		if (!this.last) this.last = ChunkType.Block;
	}

	isEmpty() {
		return this.result === '';
	}

	pushCondition(condition: string) {
		this.conditionStack.push(condition);
		this.indent = repeat('\t', this.conditionStack.length);
	}

	popCondition() {
		this.conditionStack.pop();
		this.indent = repeat('\t', this.conditionStack.length);
	}

	toString() {
		return this.result.trim() + (this.lastCondition ? `\n}` : ``);
	}
}
