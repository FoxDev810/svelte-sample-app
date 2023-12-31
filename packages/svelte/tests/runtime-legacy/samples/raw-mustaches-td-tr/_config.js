import { test } from '../../test';

export default test({
	get props() {
		return { raw: '<tr><td>1</td><td>2</td></tr>' };
	},

	html: `
		<table>
			<tbody>
				<tr>
					<td>5</td><td>7</td>
				</tr>
				<tr>
					<td>1</td><td>2</td>
				</tr>
			</tbody>
		</table>
	`
});
