const promise = Promise.resolve(42);

export default {
	data: {
		promise
	},

	test(assert, component, target) {
		return promise.then(() => {
			assert.htmlEqual(target.innerHTML, `
				<p>42</p>
				<p>true</p>
			`);
		});
	}
};