function preload(input) {
	return output;
}
var SvelteComponent = {};
SvelteComponent.data = function() {
	return {};
};

SvelteComponent.render = function(state, options = {}) {
	var components = new Set();

	function addComponent(component) {
		components.add(component);
	}

	var result = { head: '', addComponent };
	var html = SvelteComponent._render(result, state, options);

	var cssCode = Array.from(components).map(c => c.css && c.css.code).filter(Boolean).join('\n');

	return {
		html,
		head: result.head,
		css: { code: cssCode, map: null },
		toString() {
			return html;
		}
	};
};

SvelteComponent._render = function(__result, ctx, options) {
	__result.addComponent(SvelteComponent);

	ctx = Object.assign({}, ctx);

	return ``;
};

SvelteComponent.css = {
	code: '',
	map: null
};

SvelteComponent.preload = preload;

module.exports = SvelteComponent;
