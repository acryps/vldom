import fs = require("fs");
import esprima = require("esprima");

export class DomCompiler {
	static configFile = "tsconfig.json";

	constructor() {
		if (!fs.existsSync(DomCompiler.configFile)) {
			throw new Error(`no '${DomCompiler.configFile}' found in '${process.cwd()}'`);
		}

		const config = JSON.parse(fs.readFileSync(DomCompiler.configFile).toString());

		if (config.compilerOptions.outFile) {
			this.compile(config.compilerOptions.outFile);
		} else {
			this.scan(config.compilerOptions.outDir);
		}
	}

	compile(path: string) {
		let source = fs.readFileSync(path).toString();

		if (source.trim().startsWith("// @vldom ignore")) {
			return;
		}

		if (source.trim().startsWith("// @vldom parsed")) {
			console.warn(`ignoring already parsed file '${path}'`);

			return;
		}

		esprima.parseScript(source, {}, (node, meta) => {
			if (node.type == "CallExpression") {
				console.log(source.substring(meta.start.offset, meta.end.offset));
			}
		});
	}

	scan(directory: string) {
		for (let item of fs.readdirSync(directory)) {
			const path = `${directory}/${item}`;

			if (fs.lstatSync(path).isDirectory()) {
				this.scan(path);
			} else if (path.endsWith(".js")) {
				try {
					this.compile(path);
				} catch (e) {
					console.error(`Compiling of '${path}' failed!`, e);
				}
			}
		}
	}
}