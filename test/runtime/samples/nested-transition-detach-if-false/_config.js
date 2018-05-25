export default {
	html: `
		<li>
			<span>a</span>
			<ul>
				<li>
					<span>a/b</span>
					<ul>
						<li>a/b/c</li>
					</ul>
				</li>
			</ul>
		</li>
	`,

	nestedTransitions: true,

	test(assert, component, target, window, raf) {
		component.refs.folder.set({ open: false });
		assert.htmlEqual(target.innerHTML, `
			<li>
				<span>a</span>
			</li>
		`);
	},
};
