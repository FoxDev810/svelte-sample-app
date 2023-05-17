import { assert, describe, it } from 'vitest';
import {
	CONTENTEDITABLE_BINDINGS,
	get_contenteditable_attr,
	has_contenteditable_attr,
	is_contenteditable,
	is_name_contenteditable
} from '../../src/compiler/compile/utils/contenteditable';
import get_name_from_filename from '../../src/compiler/compile/utils/get_name_from_filename';
import { trim_end, trim_start } from '../../src/compiler/utils/trim';
import { split_css_unit } from '../../src/runtime/internal/utils';

describe('utils', () => {
	describe('trim', () => {
		it('trim_start', () => {
			const value = trim_start('	\r\n\t svelte content \r\n\t	');
			assert.equal(value, 'svelte content \r\n\t	');
		});

		it('trim_end', () => {
			const value = trim_end('	\r\n\t svelte content \r\n\t	');
			assert.equal(value, '	\r\n\t svelte content');
		});
	});

	describe('split_css_unit', () => {
		it('should use px as default', () => {
			assert.deepEqual(split_css_unit(10), [10, 'px']);
			assert.deepEqual(split_css_unit('10'), [10, 'px']);
		});

		it('should split the css notation into value and unit', () => {
			assert.deepEqual(split_css_unit('-50%'), [-50, '%']);
			assert.deepEqual(split_css_unit('0.1rem'), [0.1, 'rem']);
			assert.deepEqual(split_css_unit('.1rem'), [0.1, 'rem']);
		});
	});

	describe('get_name_from_filename', () => {
		it('uses the basename', () => {
			assert.equal(get_name_from_filename('path/to/Widget.svelte'), 'Widget');
		});

		it('uses the directory name, if basename is index', () => {
			assert.equal(get_name_from_filename('path/to/Widget/index.svelte'), 'Widget');
		});

		it('handles Windows filenames', () => {
			assert.equal(get_name_from_filename('path\\to\\Widget.svelte'), 'Widget');
		});

		it('handles special characters in filenames', () => {
			assert.equal(get_name_from_filename('@.svelte'), '_');
			assert.equal(get_name_from_filename('&.svelte'), '_');
			assert.equal(get_name_from_filename('~.svelte'), '_');
		});
	});

	/** @typedef {import("../../src/compiler/compile/nodes/Element.js").default} Element */
	/** @typedef {import("../../src/compiler/compile/nodes/Attribute.js").default} Attribute */

	describe('contenteditable', () => {
		describe('is_contenteditable', () => {
			it('returns false if node is input', () => {
				const node = /** @type {Element} */ ({ name: 'input' });
				assert.equal(is_contenteditable(node), false);
			});
			it('returns false if node is textarea', () => {
				const node = /** @type {Element} */ ({ name: 'textarea' });
				assert.equal(is_contenteditable(node), false);
			});
			it('returns false if node is not input or textarea AND it is not contenteditable', () => {
				const attr = /** @type {Attribute}*/ ({ name: 'href' });
				const node = /** @type {Element} */ ({ name: 'a', attributes: [attr] });
				assert.equal(is_contenteditable(node), false);
			});
			it('returns true if node is not input or textarea AND it is contenteditable', () => {
				const attr = /** @type {Attribute}*/ ({ name: 'contenteditable' });
				const node = /** @type {Element} */ ({ name: 'a', attributes: [attr] });
				assert.equal(is_contenteditable(node), true);
			});
		});

		describe('has_contenteditable_attr', () => {
			it('returns true if attribute is contenteditable', () => {
				const attr = /** @type {Attribute}*/ ({ name: 'contenteditable' });
				const node = /** @type {Element} */ ({ attributes: [attr] });
				assert.equal(has_contenteditable_attr(node), true);
			});
			it('returns false if attribute is not contenteditable', () => {
				const attr = /** @type {Attribute}*/ ({ name: 'href' });
				const node = /** @type {Element} */ ({ attributes: [attr] });
				assert.equal(has_contenteditable_attr(node), false);
			});
		});

		describe('is_name_contenteditable', () => {
			it('returns true if name is a contenteditable type', () => {
				assert.equal(is_name_contenteditable(CONTENTEDITABLE_BINDINGS[0]), true);
			});
			it('returns false if name is not contenteditable type', () => {
				assert.equal(is_name_contenteditable('value'), false);
			});
		});

		describe('get_contenteditable_attr', () => {
			it('returns the contenteditable Attribute if it exists', () => {
				const attr = /** @type {Attribute}*/ ({ name: 'contenteditable' });
				const node = /** @type {Element} */ ({ name: 'div', attributes: [attr] });
				assert.equal(get_contenteditable_attr(node), attr);
			});
			it('returns undefined if contenteditable attribute cannot be found', () => {
				const node = /** @type {Element} */ ({ name: 'div', attributes: [] });
				assert.equal(get_contenteditable_attr(node), undefined);
			});
		});
	});
});
