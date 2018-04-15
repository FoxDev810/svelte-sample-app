import { Store } from '../../../../store.js';

class MyStore extends Store {
	setName(name) {
		this.set({ name });
	}
}

const store = new MyStore({
	name: 'world'
});

export default {
	store,

	html: `
		<h1>Hello world!</h1>
		<input>
	`,

	test(assert, component, target, window) {
		const input = target.querySelector('input');
		const event = new window.Event('input');

		input.value = 'everybody';
		input.dispatchEvent(event);

		assert.equal(store.get().name, 'everybody');
		assert.htmlEqual(target.innerHTML, `
			<h1>Hello everybody!</h1>
			<input>
		`);
	}
};