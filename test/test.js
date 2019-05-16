const glob = require("tiny-glob/sync.js");

require("./setup");

glob("*/index.{js,ts}", { cwd: "test" }).forEach(function(file) {
	require("./" + file);
});