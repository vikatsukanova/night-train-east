import ts from "typescript";
import { expect, it } from "vitest";

const features = new Set([
	"world",
	"train",
	"player",
	"npc",
	"dialogue",
	"audio",
	"ui",
]);
const featureDependencies = new Set(["core", "content", "render"]);
const root = ts.sys.resolvePath("src").replaceAll("\\", "/");

function moduleReference(node: ts.Node) {
	if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
		return node.moduleSpecifier;
	if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
		return node.argument.literal;
	if (
		ts.isCallExpression(node) &&
		node.expression.kind === ts.SyntaxKind.ImportKeyword
	) {
		return node.arguments[0];
	}
}

// Vite also accepts source imports that TypeScript does not resolve, such as CSS and ?raw.
function viteSourcePath(specifier: string, importer: string) {
	const path = specifier.split("?")[0] ?? "";
	if (path.startsWith("./") || path.startsWith("../")) {
		return ts.sys.resolvePath(
			`${importer.slice(0, importer.lastIndexOf("/"))}/${path}`,
		);
	}
	if (path.startsWith("/src/")) return ts.sys.resolvePath(`.${path}`);
}

function isGuardedDevImport(specifier: ts.Node): boolean {
	if (!ts.isCallExpression(specifier.parent)) return false;
	let child: ts.Node = specifier.parent;
	for (
		let parent = child.parent;
		parent;
		child = parent, parent = parent.parent
	) {
		if (ts.isIfStatement(parent) && child === parent.thenStatement) {
			if (parent.expression.getText() === "import.meta.env.DEV") return true;
		}
	}
	return false;
}

it("keeps core, content, features and dev within their dependency boundaries", () => {
	const config = ts.getParsedCommandLineOfConfigFile(
		"tsconfig.json",
		{},
		{
			...ts.sys,
			onUnRecoverableConfigFileDiagnostic: (error) => {
				throw new Error(
					ts.flattenDiagnosticMessageText(error.messageText, "\n"),
				);
			},
		},
	);
	if (!config) throw new Error("Could not load tsconfig.json.");
	const { options } = config;

	const violations: string[] = [];
	for (const file of ts.sys.readDirectory(root, [
		".ts",
		".tsx",
		".js",
		".jsx",
		".mts",
		".mjs",
	])) {
		const source = ts.createSourceFile(
			file,
			ts.sys.readFile(file) ?? "",
			ts.ScriptTarget.Latest,
			true,
		);
		const from = file.slice(root.length + 1).split("/")[0] ?? "";

		function visit(node: ts.Node) {
			const specifier = moduleReference(node);
			if (specifier && ts.isStringLiteralLike(specifier)) {
				const target =
					ts.resolveModuleName(specifier.text, file, options, ts.sys)
						.resolvedModule?.resolvedFileName ??
					viteSourcePath(specifier.text, file);
				if (target?.startsWith(`${root}/`)) {
					const to = target.slice(root.length + 1).split("/")[0] ?? "";
					const forbidden =
						from !== to &&
						(from === "core" ||
							(from === "content" && to !== "core") ||
							(features.has(from) &&
								to !== "dev" &&
								!featureDependencies.has(to)) ||
							(to === "dev" && !isGuardedDevImport(specifier)));
					if (forbidden) violations.push(`${file}: ${specifier.text}`);
				}
			}
			ts.forEachChild(node, visit);
		}
		visit(source);
	}
	expect(violations).toEqual([]);
});
