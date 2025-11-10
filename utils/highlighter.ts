// utils/highlighter.ts

/**
 * Maps token types to Tailwind CSS classes for syntax highlighting.
 */
export const typeToClassMap: Record<string, string> = {
    comment: 'text-slate-500 italic',
    string: 'text-lime-400',
    number: 'text-amber-500 font-semibold',
    keyword: 'text-pink-400 font-semibold',
    type: 'text-sky-300',
    function: 'text-[#4ac94a]',
    bracket: 'text-purple-400 font-bold',
    op: 'text-slate-400',
    id: 'text-slate-300',
    tag: 'text-pink-400 font-semibold',
    'attr-name': 'text-sky-300',
    'attr-value': 'text-lime-400',
    color: 'text-fuchsia-400 font-semibold',
    property: 'text-sky-300',
    selector: 'text-amber-500',
    key: 'text-sky-300',
    boolean: 'text-pink-400',
    null: 'text-purple-400',
    meta: 'text-cyan-400',
    variable: 'text-teal-300',
    'at-rule': 'text-purple-400',
    unknown: 'text-slate-300',
    error: 'bg-red-500/20 underline decoration-red-400 decoration-wavy',
    whitespace: 'text-transparent', // Make whitespace visible only for rendering, not coloring
};

/**
 * Defines syntax rules for various programming languages.
 * Each rule includes a token type and a regular expression to match.
 * `errorMessage` can be added for specific error patterns.
 */
export const languageRules: Record<string, { type: string; regex: RegExp; errorMessage?: string }[]> = {
    js: [
        { type: 'error', regex: /^`[^`]*$/, errorMessage: 'Unterminated template literal.' },
        { type: 'error', regex: /^"[^"\n]*$/, errorMessage: 'Unterminated string literal.' },
        { type: 'error', regex: /^'[^'\n]*$/, errorMessage: 'Unterminated string literal.' },
        { type: 'comment', regex: /^(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/ },
        { type: 'string', regex: /^`(?:\\[\s\S]|[^`])*`|^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'string', regex: /^\/(?!\*)(?:[^\r\n\[/\\]|\\.|\[(?:[^\r\n\]\\]|\\.)*\])+\/[gimsuy]*/ }, // Regex
        { type: 'number', regex: /^\b(?:0x[a-fA-F0-9]+|[0-9]+(?:\.[0-9]+)?(?:e[+-]?\d+)?)\b/i },
        {
            type: 'keyword',
            regex: /^\b(?:if|else|for|while|function|return|const|let|var|class|new|in|of|switch|case|break|continue|try|catch|throw|async|await|export|import|from|default|extends|super|instanceof|typeof|void|delete|yield|debugger|with|get|set)\b/,
        },
        { type: 'boolean', regex: /^\b(true|false)\b/ },
        { type: 'null', regex: /^\b(null|undefined)\b/ },
        { type: 'function', regex: /^\b[a-zA-Z_$][\w$]*(?=\s*\()/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'op', regex: /^=>|\.\.\.|==|===|!=|!==|<=|>=|[-+*/%=<>!&|^~?:.,;]/ },
        { type: 'id', regex: /^\b[a-zA-Z_$][\w$]*\b/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    html: [
        { type: 'error', regex: /^<[\w\d\-]+(?:(?:"[^"]*"|'[^']*'|[^>])+)?$/, errorMessage: 'Unclosed HTML tag.' },
        { type: 'meta', regex: /^<!DOCTYPE[\s\S]*?>/i },
        { type: 'comment', regex: /^<!--[\s\S]*?-->/ },
        { type: 'tag', regex: /^<\/?[\w\d\-]+/ },
        { type: 'attr-name', regex: /^\s+[\w\d\-]+(?==)/ },
        { type: 'op', regex: /^=/ },
        { type: 'attr-value', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'tag', regex: /^>/ },
        { type: 'text', regex: /^[^<]+/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    css: [
        { type: 'error', regex: /^"[^"\n]*$/, errorMessage: 'Unterminated string.' },
        { type: 'error', regex: /^'[^'\n]*$/, errorMessage: 'Unterminated string.' },
        { type: 'error', regex: /^\/\*[\s\S]*?$/, errorMessage: 'Unterminated comment block.' },
        { type: 'comment', regex: /^\/\*[\s\S]*?\*\// },
        { type: 'at-rule', regex: /^@[\w\-]+/ },
        { type: 'string', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'property', regex: /^[a-zA-Z\-]+(?=\s*:)/ },
        { type: 'selector', regex: /^(?:[.#]?[a-zA-Z0-9\-_*]+|\[[^\]]+\]|:{1,2}[a-zA-Z\-]+(?:\([^\)]+\))?)/ },
        { type: 'function', regex: /^\b(?:url|var|calc|rgb|rgba|hsl|hsla)(?=\()/ },
        { type: 'color', regex: /^#(?:[0-9a-fA-F]{3,8})\b/ },
        { type: 'number', regex: /^\b-?\d+(\.\d+)?(px|em|rem|%|vw|vh|s|deg|fr|ms)?\b/i },
        {
            type: 'keyword',
            regex: /^\b(!important|auto|inherit|initial|unset|none|block|inline|inline-block|flex|grid|absolute|relative|fixed|static|sticky|solid|dashed|dotted|hidden|visible|scroll|uppercase|lowercase|capitalize|center|left|right|justify|start|end|bold|normal|italic)\b/i,
        },
        { type: 'op', regex: /^[:;,>+~]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    xml: [
        { type: 'error', regex: /^<[\w\d\-:]+(?:(?:"[^"]*"|'[^']*'|[^>])+)?$/, errorMessage: 'Unclosed XML tag.' },
        { type: 'comment', regex: /^<!--[\s\S]*?-->/ },
        { type: 'meta', regex: /^<\?[\s\S]*?\?>/ },
        { type: 'meta', regex: /^<!\[CDATA\[[\s\S]*?\]\]>/ },
        { type: 'tag', regex: /^<\/?[\w\d\-:]+/ },
        { type: 'attr-name', regex: /^\s+[\w\d\-:]+(?==)/ },
        { type: 'op', regex: /^=/ },
        { type: 'attr-value', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'tag', regex: /^\/?>/ },
        { type: 'text', regex: /^[^<]+/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    php: [
        { type: 'meta', regex: /^<\?php|^\?>|<\?=/ },
        { type: 'comment', regex: /^(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/ },
        { type: 'variable', regex: /^\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/ },
        { type: 'string', regex: /^"(?:\\.|[^"\\])*"|^'(?:\\.|[^'\\])*'/ },
        { type: 'number', regex: /^\b\d+(\.\d+)?(?:e[+-]?\d+)?\b/i },
        {
            type: 'keyword',
            regex: /^\b(?:echo|if|else|elseif|while|for|foreach|function|return|const|class|new|public|protected|private|static|__halt_compiler|abstract|and|array|as|break|callable|case|catch|clone|continue|declare|default|die|do|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|eval|exit|extends|final|finally|global|goto|implements|include|include_once|instanceof|insteadof|interface|isset|list|namespace|or|print|require|require_once|switch|throw|trait|try|unset|use|var|xor|yield|__CLASS__|__DIR__|__FILE__|__FUNCTION__|__LINE__|__METHOD__|__NAMESPACE__|__TRAIT__)\b/i,
        },
        { type: 'boolean', regex: /^\b(true|false)\b/i },
        { type: 'null', regex: /^\bnull\b/i },
        { type: 'function', regex: /^\b[a-zA-Z_][\w_]*(?=\s*\()/ },
        { type: 'op', regex: /^->|=>|==|===|!=|!==|<=|>=|[-+*\/%<>&|^~?:.,;]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'comment', regex: /^<!--[\s\S]*?-->/ }, // HTML comments within PHP
        { type: 'tag', regex: /^<\/?[\w\d\-]+/ }, // HTML tags within PHP
        { type: 'attr-name', regex: /^\s+[\w\d\-]+(?==)/ },
        { type: 'op', regex: /^=/ },
        { type: 'attr-value', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'tag', regex: /^>/ },
        { type: 'text', regex: /^[^<>$]+/ }, // Generic text not matched by PHP or HTML
        { type: 'whitespace', regex: /^\s+/ },
    ],
    sql: [
        { type: 'comment', regex: /^(--[^\n]*|\/\*[\s\S]*?\*\/)/ },
        { type: 'string', regex: /^'(?:[^']|'')*'/ }, // SQL strings use '' to escape '
        { type: 'number', regex: /^\b-?\d+(\.\d+)?\b/ },
        {
            type: 'keyword',
            regex: /^\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DATABASE|ALTER|DROP|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP\sBY|ORDER\sBY|ASC|DESC|LIMIT|OFFSET|HAVING|AS|DISTINCT|COUNT|SUM|AVG|MAX|MIN|CASE|WHEN|THEN|ELSE|END|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|INDEX|VIEW)\b/i,
        },
        { type: 'boolean', regex: /^\b(TRUE|FALSE)\b/i },
        { type: 'function', regex: /^\b[a-zA-Z_]\w*(?=\s*\()/i },
        { type: 'id', regex: /^`[^`]*`|"[^"]*"/ }, // Quoted identifiers
        { type: 'op', regex: /^[,;*<>=!%|&^~.\-+/]+/ },
        { type: 'bracket', regex: /^[()]/ },
        { type: 'id', regex: /^\b[a-zA-Z_]\w*\b/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    json: [
        { type: 'error', regex: /^"[^"\n]*$/, errorMessage: 'Unterminated string.' },
        { type: 'key', regex: /^"(?:\\.|[^"])*"(?=\s*:)/ },
        { type: 'string', regex: /^"(?:\\.|[^"])*"/ },
        { type: 'number', regex: /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i },
        { type: 'keyword', regex: /^\b(true|false|null)\b/ },
        { type: 'op', regex: /^[:,]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    py: [
        { type: 'error', regex: /^(?:'''[\s\S]*?$|"""[\s\S]*?$)/, errorMessage: 'Unterminated multi-line string.' },
        { type: 'error', regex: /^'[^'\n]*$/, errorMessage: 'Unterminated string.' },
        { type: 'error', regex: /^"[^"\n]*$/, errorMessage: 'Unterminated string.' },
        { type: 'comment', regex: /^#[^\n]*/ },
        { type: 'string', regex: /^(?:[furbFUBR]{0,2})?(?:'''[\s\S]*?'''|"""[\s\S]*?"""|'[^'\n]*'|"[^"\n]*")/ },
        {
            type: 'keyword',
            regex: /^\b(def|return|if|else|elif|for|while|import|from|as|class|try|except|finally|with|lambda|yield|in|is|not|and|or|pass|continue|break|async|await|assert|del|global|nonlocal|raise)\b/,
        },
        { type: 'boolean', regex: /^\b(True|False)\b/ },
        { type: 'null', regex: /^\b(None)\b/ },
        { type: 'function', regex: /^\b[a-zA-Z_]\w*(?=\s*\()/ },
        { type: 'meta', regex: /^@\w+/ }, // Decorators
        { type: 'number', regex: /^\b\d+(\.\d+)?\b/ },
        { type: 'op', regex: /^[-+*/%=<>!&|^~:.,;@]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    bash: [
        { type: 'comment', regex: /^#[^\n]*/ },
        { type: 'string', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        {
            type: 'keyword',
            regex: /^\b(if|then|else|elif|fi|case|esac|for|select|while|until|do|done|in|function|time|coproc)\b/,
        },
        {
            type: 'function', // built-ins
            regex: /^\b(alias|bg|bind|break|builtin|caller|cd|command|compgen|complete|compopt|continue|declare|dirs|disown|echo|enable|eval|exec|exit|export|false|fc|fg|getopts|hash|help|history|jobs|kill|let|local|logout|mapfile|popd|printf|pushd|pwd|read|readarray|readonly|return|set|shift|shopt|source|suspend|test|times|trap|true|type|typeset|ulimit|umask|unalias|unset|wait)\b/,
        },
        { type: 'variable', regex: /^\$([a-zA-Z_]\w*|\d+|\?|#|@|\*|\$)/ },
        { type: 'variable', regex: /^\$\{[^}]*\}/ },
        { type: 'number', regex: /^\b\d+\b/ },
        { type: 'op', regex: /^(\[\[|\]\]|\|\||&&|;|\||&|>|<|>>|<<|`)/ },
        { type: 'bracket', regex: /^[()]/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
};

/**
 * Interface for a token identified by the tokenizer.
 */
export interface Token {
    type: string;
    value: string;
    errorMessage?: string;
}

/**
 * Tokenizes a given text based on specified language rules.
 * @param {string} text - The input text to tokenize.
 * @param {string} language - The language identifier (e.g., 'js', 'html', 'css').
 * @returns {Token[]} An array of tokens.
 */
export const tokenize = (text: string, language: string): Token[] => {
    const rules = languageRules[language] || [];
    if (rules.length === 0) {
        return [{ type: 'unknown', value: text }];
    }

    const tokens: Token[] = [];
    let position = 0;

    while (position < text.length) {
        let matched = false;
        for (const rule of rules) {
            const match = rule.regex.exec(text.slice(position));
            if (match && match[0].length > 0) {
                tokens.push({ type: rule.type, value: match[0], errorMessage: rule.errorMessage });
                position += match[0].length;
                matched = true;
                break;
            }
        }
        if (!matched) {
            // If no rule matches, take a single character as an unknown token
            tokens.push({ type: 'unknown', value: text[position], errorMessage: `Invalid or unexpected token.` });
            position++;
        }
    }
    return tokens;
};

/**
 * Escapes HTML special characters in a string.
 * @param {string} str - The input string.
 * @returns {string} The HTML-escaped string.
 */
export const escapeHtml = (str: string) => {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

/**
 * Highlights a given text string using the specified language rules.
 * This version is generic and does not include selection highlighting.
 * @param {string} text - The input text to highlight.
 * @param {string} language - The language identifier.
 * @returns {string} The HTML string with syntax highlighting spans.
 */
export const highlightBasic = (text: string, language: string): string => {
    if (!text) return '';
    const tokens = tokenize(text, language);

    return tokens
        .map((token) => {
            const isError = !!token.errorMessage;
            const safeTitle = token.errorMessage?.replace(/"/g, '&quot;');
            const titleAttr = isError ? `title="${safeTitle}"` : '';
            const className = isError ? typeToClassMap['error'] : typeToClassMap[token.type] || typeToClassMap['unknown'];

            const escapedValue = escapeHtml(token.value);

            return `<span class="${className}" ${titleAttr}>${escapedValue}</span>`;
        })
        .join('');
};