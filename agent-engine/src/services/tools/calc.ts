import { toolRegistry } from "./registry.js";

/**
 * Calculadora científica segura (sin eval).
 * Soporta: +, -, *, /, ^, %, (), sqrt(), abs(), round(), floor(), ceil(),
 * sin(), cos(), tan(), log(), ln(), pi, e
 */

// ─── Tokenizer ───────────────────────────────────────────────────────────

type Token =
	| { type: "num"; value: number }
	| { type: "op"; value: string }
	| { type: "func"; value: string }
	| { type: "paren"; value: "(" | ")" }
	| { type: "sep" }; // comma

const FUNCTIONS = new Set([
	"sqrt", "abs", "round", "floor", "ceil",
	"sin", "cos", "tan",
	"log", "ln",
]);

const CONSTANTS: Record<string, number> = {
	pi: Math.PI,
	e: Math.E,
};

function tokenize(expr: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < expr.length) {
		const ch = expr[i];
		if (/\s/.test(ch)) { i++; continue; }

		// Number (including decimals)
		if (/\d/.test(ch) || (ch === "." && i + 1 < expr.length && /\d/.test(expr[i + 1]))) {
			let num = "";
			while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === ".")) {
				num += expr[i++];
			}
			tokens.push({ type: "num", value: parseFloat(num) });
			continue;
		}

		// Constants
		if (/^[a-z]+$/.test(ch)) {
			let word = "";
			while (i < expr.length && /^[a-z]$/i.test(expr[i])) {
				word += expr[i++];
			}
			const lower = word.toLowerCase();
			if (CONSTANTS[lower] !== undefined) {
				tokens.push({ type: "num", value: CONSTANTS[lower] });
			} else if (FUNCTIONS.has(lower)) {
				tokens.push({ type: "func", value: lower });
			} else {
				throw new Error(`Unknown identifier: "${word}"`);
			}
			continue;
		}

		// Operators
		if ("+-*/^%".includes(ch)) {
			tokens.push({ type: "op", value: ch });
			i++;
			continue;
		}

		// Parentheses
		if (ch === "(" || ch === ")") {
			tokens.push({ type: "paren", value: ch });
			i++;
			continue;
		}

		// Comma (function argument separator)
		if (ch === ",") {
			tokens.push({ type: "sep" });
			i++;
			continue;
		}

		throw new Error(`Unexpected character: "${ch}"`);
	}
	return tokens;
}

// ─── Parser (recursive descent) ─────────────────────────────────────────

interface ParseResult {
	result: number;
	nextIndex: number;
}

class Parser {
	private tokens: Token[];
	private pos: number;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.pos = 0;
	}

	peek(): Token | null {
		return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
	}

	consume(): Token {
		if (this.pos >= this.tokens.length) throw new Error("Unexpected end of expression");
		return this.tokens[this.pos++];
	}

	// expr = term (('+' | '-') term)*
	parseExpression(): number {
		let left = this.parseTerm();
		let peek = this.peek();
		while (peek && peek.type === "op" && (peek.value === "+" || peek.value === "-")) {
			const opToken = this.consume();
			if (opToken.type !== "op") throw new Error("Expected operator");
			const right = this.parseTerm();
			left = opToken.value === "+" ? left + right : left - right;
			peek = this.peek();
		}
		return left;
	}

	// term = factor (('*' | '/' | '%' | '^') factor)*
	parseTerm(): number {
		let left = this.parseFactor();
		let peek = this.peek();
		while (peek && peek.type === "op" && ["*", "/", "%", "^"].includes(peek.value)) {
			const opToken = this.consume();
			if (opToken.type !== "op") throw new Error("Expected operator");
			const right = this.parseFactor();
			switch (opToken.value) {
				case "*": left *= right; break;
				case "/":
					if (right === 0) throw new Error("Division by zero");
					left /= right; break;
				case "%": left %= right; break;
				case "^": left = Math.pow(left, right); break;
			}
			peek = this.peek();
		}
		return left;
	}

	// factor = num | '(' expr ')' | func '(' expr ')' | '-' factor
	parseFactor(): number {
		const token = this.peek();

		if (!token) throw new Error("Unexpected end of expression");

		// Unary minus
		if (token.type === "op" && token.value === "-") {
			this.consume();
			return -this.parseFactor();
		}

		// Unary plus
		if (token.type === "op" && token.value === "+") {
			this.consume();
			return this.parseFactor();
		}

		// Number
		if (token.type === "num") {
			const numToken = this.consume() as { type: "num"; value: number };
			return numToken.value;
		}

		// Parenthesized expression
		if (token.type === "paren" && token.value === "(") {
			this.consume();
			const result = this.parseExpression();
			const closeToken = this.consume() as { type: "paren"; value: "(" | ")" };
			if (closeToken.type !== "paren" || closeToken.value !== ")") {
				throw new Error("Expected ')'");
			}
			return result;
		}

		// Function call
		if (token.type === "func") {
			const funcToken = this.consume() as { type: "func"; value: string };
			const func = funcToken.value;
			const parenOpen = this.peek();
			if (!parenOpen || parenOpen.type !== "paren" || parenOpen.value !== "(") {
				throw new Error(`Expected '(' after '${func}'`);
			}
			this.consume(); // '('

			// Collect arguments (currently only single-arg functions supported)
			const arg = this.parseExpression();

			const parenClose = this.peek();
			if (!parenClose || parenClose.type !== "paren" || parenClose.value !== ")") {
				throw new Error(`Expected ')' after argument of '${func}'`);
			}
			this.consume(); // ')'

			return this.applyFunction(func, arg);
		}

		throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
	}

	private applyFunction(name: string, arg: number): number {
		switch (name) {
			case "sqrt": return Math.sqrt(arg);
			case "abs": return Math.abs(arg);
			case "round": return Math.round(arg);
			case "floor": return Math.floor(arg);
			case "ceil": return Math.ceil(arg);
			case "sin": return Math.sin(arg);
			case "cos": return Math.cos(arg);
			case "tan": return Math.tan(arg);
			case "log": return Math.log10(arg);
			case "ln": return Math.log(arg);
			default: throw new Error(`Unknown function: ${name}`);
		}
	}

	parse(): number {
		const result = this.parseExpression();
		if (this.pos < this.tokens.length) {
			throw new Error(`Unexpected token after expression: ${JSON.stringify(this.tokens[this.pos])}`);
		}
		return result;
	}
}

export function registerCalcTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "calc",
				description: "Calculadora científica. Evalúa expresiones matemáticas de forma segura. Soporta: + - * / ^ % () sqrt() abs() round() floor() ceil() sin() cos() tan() log() ln() pi e",
				parameters: {
					type: "object",
					properties: {
						expression: {
							type: "string",
							description: "Expresión matemática a evaluar (ej: '2 + 2', 'sqrt(144)', 'sin(pi/2)', '3.14 * 5^2')",
						},
						precision: {
							type: "number",
							description: "Decimales de precisión (default: 4)",
						},
					},
					required: ["expression"],
				},
			},
		},
		handler: async (args: Record<string, unknown>) => {
			const expr = (args.expression as string || "").trim();
			const precision = (args.precision as number) ?? 4;

			if (!expr) {
				return "Error: Debes proporcionar una expresión matemática.";
			}

			try {
				const tokens = tokenize(expr);
				const parser = new Parser(tokens);
				const result = parser.parse();

				// Check for infinity/NaN
				if (!Number.isFinite(result)) {
					return `Resultado: ${result}`;
				}

				const formatted = precision > 0
					? parseFloat(result.toFixed(precision)).toString()
					: Math.round(result).toString();

				return `${expr} = **${formatted}**`;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error en la expresión: ${msg}`;
			}
		},
		enabled: true,
	});
}
