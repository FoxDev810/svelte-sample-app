export default {
	data: {
		color: 'red',
	},

	html: `
		<div>
			<style>
			/* something with < and > */
				div {
					color: blue;
				}
			</style>
			foo
		</div>

		<div>
			<div>
				<style>
					div > div {
						color: red;
					}
				</style>
				foo
			</div>
		</div>
	`,
};
