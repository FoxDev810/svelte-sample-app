import fs from 'fs';
import path from 'path';
import process_markdown from '../../../utils/_process_markdown.js';
import marked from 'marked';

import PrismJS from 'prismjs';
import 'prismjs/components/prism-bash';

// map lang to prism-language-attr
const prismLang = {
	bash: 'bash',
	html: 'markup',
	js: 'javascript',
	css: 'css',
};

export default function() {
	return fs
		.readdirSync('content/blog')
		.map(file => {
			if (path.extname(file) !== '.md') return;

			const markdown = fs.readFileSync(`content/blog/${file}`, 'utf-8');

			const { content, metadata } = process_markdown(markdown);

			const date = new Date(`${metadata.pubdate} EDT`); // cheeky hack
			metadata.dateString = date.toDateString();

			const renderer = new marked.Renderer();

			renderer.code = (source, lang) => {
				const plang = prismLang[lang];
				const highlighted = PrismJS.highlight(
					source,
					PrismJS.languages[plang],
					lang,
				);

				return `<pre class='language-${plang}'><code>${highlighted}</code></pre>`;
			};

			const html = marked(
				content.replace(/^\t+/gm, match => match.split('\t').join('  ')),
				{ renderer }
			);

			return {
				html,
				metadata,
				slug: file.replace(/^[\d-]+/, '').replace(/\.md$/, ''),
			};
		})
		.sort((a, b) => a.metadata.pubdate < b.metadata.pubdate ? 1 : -1);
}
