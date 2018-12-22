import fetch from 'node-fetch';
import { body } from './_utils.js';

export async function post(req, res) {
	const user = req.session.passport && req.session.passport.user;

	if (!user) {
		res.writeHead(403, {
			'Content-Type': 'application/json'
		});
		res.end(JSON.stringify({ error: 'unauthorized' }));
		return;
	}

	try {
		const { name, components, json5 } = await body(req);

		const files = {
			'meta.json': {
				content: JSON.stringify({
					svelte: true
				}, null, '  ')
			},
			'README.md': {
				content: `Created with [svelte.technology/repl](https://svelte.technology/repl)`
			}
		};
		components.forEach(component => {
			const file = `${component.name}.${component.type}`;
			if (!component.source.trim()) {
				throw new Error(`GitHub does not allow saving gists with empty files - ${file}`);
			}
			files[file] = { content: component.source };
		});

		if (json5) {
			files['data.json5'] = { content: json5 };
		}

		const r = await fetch(`https://api.github.com/gists`, {
			method: 'POST',
			headers: {
				Authorization: `token ${user.token}`
			},
			body: JSON.stringify({
				description: name,
				files,
				public: false
			})
		});

		res.writeHead(r.status, {
			'Content-Type': 'application/json'
		});

		const gist = await r.json();

		res.end(JSON.stringify({
			id: gist.id,
			description: gist.description,
			owner: gist.owner,
			html_url: gist.html_url,
			files: gist.files
		}));
	} catch (err) {
		res.writeHead(500, {
			'Content-Type': 'application/json'
		});

		res.end(JSON.stringify({
			error: err.message
		}));
	}
}
