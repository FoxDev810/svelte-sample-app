let fulfil;

let thePromise = new Promise(f => {
	fulfil = f;
});

export default {
	data: {
		thePromise
	},

	html: `
		<p>loading...</p><p>true!</p>
	`,

	test(assert, component, target) {
		fulfil(42);

		return thePromise
			.then(() => {
				assert.htmlEqual(target.innerHTML, `
					<p>the value is 42</p><p>true!</p>
				`);
			});

	}
};
