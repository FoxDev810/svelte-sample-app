import { test } from '../../test';
import { sleep } from './sleep.js';

export default test({
	html: `
		<p>loading...</p>
	`,

	test({ assert, target }) {
		return sleep(50).then(() => {
			assert.htmlEqual(
				target.innerHTML,
				`
				<p>the answer is 42</p>
				<p>count: 1</p>
			`
			);
		});
	}
});
