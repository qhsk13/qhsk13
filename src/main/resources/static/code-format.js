/*
 * 코드 공유 포맷팅 유틸리티
 * - 메시지에 ```언어\n...\n``` 형태의 코드 펜스가 있으면 해당 부분을 코드 블록으로 렌더링
 * - 펜스가 없어도 내용이 코드처럼 보이면(java/jsp/html/xml/markdown/css/js/json/sql/python/bash/yaml/properties)
 *   자동으로 언어를 감지해 코드 블록으로 렌더링
 * - 들여쓰기/줄바꿈 등 원본 포맷을 그대로 보존하고, 가벼운 정규식 기반 문법 강조를 적용
 * 완전히 오프라인에서 동작하도록 외부 라이브러리 없이 구현되어 있습니다.
 */

(function (global) {
    "use strict";

    function escapeHtml(s) {
        return String(s || "").replace(/[&<>"']/g, ch => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[ch]));
    }

    // ---------- 토큰화 엔진 ----------

    function buildCombinedRegex(rules) {
        const parts = rules.map((r, i) => `(?<g${i}>${r.regex.source})`);
        return new RegExp(parts.join("|"), "gm");
    }

    function tokenize(code, rules) {
        if (!code) return "";
        const combined = buildCombinedRegex(rules);
        let out = "";
        let lastIndex = 0;
        let match;
        while ((match = combined.exec(code)) !== null) {
            if (match.index > lastIndex) out += escapeHtml(code.slice(lastIndex, match.index));
            let rule = null;
            for (let i = 0; i < rules.length; i++) {
                if (match.groups["g" + i] !== undefined) { rule = rules[i]; break; }
            }
            const text = match[0];
            if (rule && rule.render) {
                out += rule.render(text);
            } else if (rule) {
                out += `<span class="tok-${rule.type}">${escapeHtml(text)}</span>`;
            } else {
                out += escapeHtml(text);
            }
            lastIndex = match.index + text.length;
            if (text.length === 0) combined.lastIndex++;
        }
        out += escapeHtml(code.slice(lastIndex));
        return out;
    }

    // ---------- 언어별 규칙 ----------

    function javaRules() {
        return [
            {type: "comment", regex: /\/\/[^\n]*/},
            {type: "comment", regex: /\/\*[\s\S]*?\*\//},
            {type: "string", regex: /"(?:[^"\\]|\\.)*"/},
            {type: "string", regex: /'(?:[^'\\]|\\.)*'/},
            {type: "annotation", regex: /@[A-Za-z_][\w.]*/},
            {type: "number", regex: /\b0[xX][0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFdDlL]?\b/},
            {type: "keyword", regex: /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|record|return|sealed|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|var|void|volatile|while|yield|permits)\b/},
            {type: "literal", regex: /\b(?:true|false|null)\b/}
        ];
    }

    function highlightJava(code) { return tokenize(code, javaRules()); }

    function renderHtmlTag(tagText) {
        const m = tagText.match(/^<(\/?)([a-zA-Z][\w:-]*)([\s\S]*?)(\/?)>$/);
        if (!m) return `<span class="tok-tag">${escapeHtml(tagText)}</span>`;
        const slash = m[1], name = m[2], rest = m[3], selfClose = m[4];
        let attrsHtml = "";
        const attrRegex = /([a-zA-Z_:][\w:.-]*)(\s*=\s*(?:"[^"]*"|'[^']*'))?/g;
        let am, lastIdx = 0;
        while ((am = attrRegex.exec(rest)) !== null) {
            if (am[0].length === 0) { attrRegex.lastIndex++; continue; }
            attrsHtml += escapeHtml(rest.slice(lastIdx, am.index));
            const full = am[0];
            const eqIdx = full.indexOf("=");
            if (eqIdx === -1) {
                attrsHtml += `<span class="tok-attr">${escapeHtml(full)}</span>`;
            } else {
                const attrName = full.slice(0, eqIdx).replace(/\s+$/, "");
                const spacer = full.slice(attrName.length, eqIdx + 1);
                const attrValue = full.slice(eqIdx + 1);
                attrsHtml += `<span class="tok-attr">${escapeHtml(attrName)}</span>${escapeHtml(spacer)}<span class="tok-string">${escapeHtml(attrValue)}</span>`;
            }
            lastIdx = attrRegex.lastIndex;
        }
        attrsHtml += escapeHtml(rest.slice(lastIdx));
        return `<span class="tok-tag">&lt;${escapeHtml(slash)}<span class="tok-tagname">${escapeHtml(name)}</span>${attrsHtml}${escapeHtml(selfClose)}&gt;</span>`;
    }

    function htmlRules() {
        return [
            {type: "comment", regex: /<!--[\s\S]*?-->/},
            {type: "doctype", regex: /<!DOCTYPE[^>]*>/i},
            {type: "tag", regex: /<\/?[a-zA-Z][^>]*>/, render: renderHtmlTag}
        ];
    }

    function highlightHtml(code) { return tokenize(code, htmlRules()); }

    function renderJspScriptlet(text) {
        const m = text.match(/^<%([@=!]?)([\s\S]*?)%>$/);
        if (!m) return `<span class="tok-tag">${escapeHtml(text)}</span>`;
        const marker = m[1], inner = m[2];
        const innerHtml = tokenize(inner, javaRules());
        return `<span class="tok-jsp-delim">&lt;%${escapeHtml(marker)}</span>${innerHtml}<span class="tok-jsp-delim">%&gt;</span>`;
    }

    function jspRules() {
        return [
            {type: "comment", regex: /<!--[\s\S]*?-->/},
            {type: "comment", regex: /<%--[\s\S]*?--%>/},
            {type: "doctype", regex: /<!DOCTYPE[^>]*>/i},
            {type: "jsp", regex: /<%[@=!]?[\s\S]*?%>/, render: renderJspScriptlet},
            {type: "el", regex: /\$\{[^}\n]*\}/},
            {type: "tag", regex: /<\/?[a-zA-Z][^>]*>/, render: renderHtmlTag}
        ];
    }

    function highlightJsp(code) { return tokenize(code, jspRules()); }

    function markdownRules() {
        return [
            {type: "heading", regex: /^#{1,6}[ \t].*$/m},
            {type: "quote", regex: /^>.*$/m},
            {type: "inlinecode", regex: /`[^`\n]+`/},
            {type: "bold", regex: /\*\*[^*\n]+\*\*|__[^_\n]+__/},
            {type: "italic", regex: /\*[^*\n]+\*|_[^_\n]+_/},
            {type: "link", regex: /\[[^\]\n]*\]\([^)\n]*\)/},
            {type: "listmarker", regex: /^\s*(?:[-*+]|\d+\.)(?=\s)/m}
        ];
    }

    function highlightMarkdown(code) { return tokenize(code, markdownRules()); }

    // ---------- 마크다운 "뷰 형태" 렌더러 ----------
    // (highlightMarkdown은 원문에 색만 입히는 "코드 형태"이고, 아래는 실제 제목/목록/굵게 등을
    //  진짜 HTML 요소로 변환하는 "뷰 형태" 전용 렌더러다. 둘은 완전히 별개의 함수다.)

    function inlineMarkdownToHtml(text) {
        let out = escapeHtml(text);
        out = out.replace(/`([^`]+)`/g, (m, code) => `<code class="md-inline-code">${code}</code>`);
        out = out.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (m, a, b) => `<strong>${a !== undefined ? a : b}</strong>`);
        out = out.replace(/\*([^*]+)\*|_([^_]+)_/g, (m, a, b) => `<em>${a !== undefined ? a : b}</em>`);
        out = out.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (m, label, url) => {
            const safeUrl = /^https?:\/\//i.test(url) ? url : "#";
            return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        });
        return out;
    }

    function markdownToHtml(source) {
        const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
        let out = "";
        let listType = null; // "ul" | "ol" | null
        let listItems = [];
        let paragraphLines = [];

        function flushList() {
            if (!listType) return;
            const tag = listType;
            out += `<${tag}>` + listItems.map(item => `<li>${inlineMarkdownToHtml(item)}</li>`).join("") + `</${tag}>`;
            listType = null;
            listItems = [];
        }

        function flushParagraph() {
            if (paragraphLines.length === 0) return;
            out += `<p>${inlineMarkdownToHtml(paragraphLines.join(" "))}</p>`;
            paragraphLines = [];
        }

        lines.forEach(line => {
            const headingMatch = line.match(/^(#{1,6})[ \t]+(.*)$/);
            const ulMatch = line.match(/^\s*[-*+]\s+(.*)$/);
            const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
            const quoteMatch = line.match(/^>\s?(.*)$/);

            if (headingMatch) {
                flushParagraph();
                flushList();
                const level = headingMatch[1].length;
                out += `<h${level}>${inlineMarkdownToHtml(headingMatch[2])}</h${level}>`;
            } else if (ulMatch) {
                flushParagraph();
                if (listType !== "ul") { flushList(); listType = "ul"; }
                listItems.push(ulMatch[1]);
            } else if (olMatch) {
                flushParagraph();
                if (listType !== "ol") { flushList(); listType = "ol"; }
                listItems.push(olMatch[1]);
            } else if (quoteMatch) {
                flushParagraph();
                flushList();
                out += `<blockquote>${inlineMarkdownToHtml(quoteMatch[1])}</blockquote>`;
            } else if (line.trim() === "") {
                flushParagraph();
                flushList();
            } else {
                flushList();
                paragraphLines.push(line.trim());
            }
        });
        flushParagraph();
        flushList();
        return out || `<p>${escapeHtml(source)}</p>`;
    }

    function cssRules() {
        return [
            {type: "comment", regex: /\/\*[\s\S]*?\*\//},
            {type: "string", regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/},
            {type: "atrule", regex: /@[\w-]+/},
            {type: "hexcolor", regex: /#[0-9a-fA-F]{3,8}\b/},
            {type: "number", regex: /-?\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg)?\b/},
            {type: "property", regex: /[\w-]+(?=\s*:)/}
        ];
    }

    function highlightCss(code) { return tokenize(code, cssRules()); }

    function javascriptRules() {
        return [
            {type: "comment", regex: /\/\/[^\n]*/},
            {type: "comment", regex: /\/\*[\s\S]*?\*\//},
            {type: "string", regex: /`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/},
            {type: "number", regex: /\b0[xX][0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/},
            {type: "keyword", regex: /\b(?:async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|finally|for|from|function|get|if|import|in|instanceof|let|new|of|return|set|static|super|switch|this|throw|try|typeof|var|void|while|yield)\b/},
            {type: "literal", regex: /\b(?:true|false|null|undefined|NaN)\b/}
        ];
    }

    function highlightJavascript(code) { return tokenize(code, javascriptRules()); }

    function jsonRules() {
        return [
            {type: "key", regex: /"(?:[^"\\]|\\.)*"(?=\s*:)/},
            {type: "string", regex: /"(?:[^"\\]|\\.)*"/},
            {type: "number", regex: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/},
            {type: "literal", regex: /\b(?:true|false|null)\b/}
        ];
    }

    function highlightJson(code) { return tokenize(code, jsonRules()); }

    function sqlRules() {
        return [
            {type: "comment", regex: /--[^\n]*/},
            {type: "comment", regex: /\/\*[\s\S]*?\*\//},
            {type: "string", regex: /'(?:[^']|'')*'/},
            {type: "number", regex: /\b\d+(?:\.\d+)?\b/},
            {type: "keyword", regex: /\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|ON|GROUP|BY|ORDER|HAVING|AS|AND|OR|NOT|NULL|IS|IN|LIKE|LIMIT|DISTINCT|UNION|ALL|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|CASE|WHEN|THEN|ELSE|END|EXISTS|INDEX|VIEW|BEGIN|COMMIT|ROLLBACK)\b/i}
        ];
    }

    function highlightSql(code) { return tokenize(code, sqlRules()); }

    function pythonRules() {
        return [
            {type: "comment", regex: /#[^\n]*/},
            {type: "string", regex: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/},
            {type: "decorator", regex: /@[A-Za-z_][\w.]*/},
            {type: "number", regex: /\b\d+(?:\.\d+)?\b/},
            {type: "keyword", regex: /\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/},
            {type: "literal", regex: /\b(?:True|False|None|self)\b/}
        ];
    }

    function highlightPython(code) { return tokenize(code, pythonRules()); }

    function bashRules() {
        return [
            {type: "comment", regex: /#[^\n]*/},
            {type: "string", regex: /"(?:[^"\\]|\\.)*"|'[^']*'/},
            {type: "variable", regex: /\$\{[^}\n]*\}|\$\w+/},
            {type: "keyword", regex: /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|export|cd|sudo|apt|npm|pip|git|curl|wget)\b/}
        ];
    }

    function highlightBash(code) { return tokenize(code, bashRules()); }

    function yamlRules() {
        return [
            {type: "comment", regex: /#[^\n]*/},
            {type: "key", regex: /^\s*[\w.-]+(?=\s*:)/m},
            {type: "string", regex: /"(?:[^"\\]|\\.)*"|'[^']*'/},
            {type: "listmarker", regex: /^\s*-(?=\s)/m},
            {type: "literal", regex: /\b(?:true|false|null|yes|no)\b/i}
        ];
    }

    function highlightYaml(code) { return tokenize(code, yamlRules()); }

    function propertiesRules() {
        return [
            {type: "comment", regex: /^[ \t]*[#!].*$/m},
            {type: "key", regex: /^[ \t]*[^=:#!\s][^=:\n]*(?=\s*[=:])/m}
        ];
    }

    function highlightProperties(code) { return tokenize(code, propertiesRules()); }

    function highlightCode(code, lang) {
        switch (lang) {
            case "java": return highlightJava(code);
            case "jsp": return highlightJsp(code);
            case "html": return highlightHtml(code);
            case "xml": return highlightHtml(code);
            case "markdown": return highlightMarkdown(code);
            case "css": return highlightCss(code);
            case "javascript": return highlightJavascript(code);
            case "json": return highlightJson(code);
            case "sql": return highlightSql(code);
            case "python": return highlightPython(code);
            case "bash": return highlightBash(code);
            case "yaml": return highlightYaml(code);
            case "properties": return highlightProperties(code);
            default: return escapeHtml(code);
        }
    }

    // ---------- 언어 이름 정규화 ----------

    const LANG_ALIASES = {
        java: "java",
        jsp: "jsp", jspx: "jsp",
        html: "html", htm: "html", xhtml: "html",
        xml: "xml",
        md: "markdown", markdown: "markdown",
        css: "css",
        js: "javascript", javascript: "javascript", jsx: "javascript", ts: "javascript", tsx: "javascript", typescript: "javascript",
        json: "json",
        sql: "sql",
        py: "python", python: "python", python3: "python",
        sh: "bash", bash: "bash", shell: "bash", zsh: "bash",
        yml: "yaml", yaml: "yaml",
        properties: "properties", props: "properties", ini: "properties",
        txt: "plaintext", text: "plaintext", plain: "plaintext", plaintext: "plaintext"
    };

    function normalizeLang(hint) {
        const key = String(hint || "").trim().toLowerCase();
        return LANG_ALIASES[key] || null;
    }

    const LANG_LABELS = {
        java: "Java", jsp: "JSP", html: "HTML", xml: "XML", markdown: "Markdown", css: "CSS",
        javascript: "JavaScript", json: "JSON", sql: "SQL", python: "Python", bash: "Shell",
        yaml: "YAML", properties: "Properties", plaintext: "Text"
    };

    function languageLabel(lang) {
        return LANG_LABELS[lang] || String(lang || "").toUpperCase();
    }

    // ---------- 언어 자동 감지(펜스가 없는 경우) ----------

    function detectLanguage(text) {
        const t = String(text || "").replace(/\r\n/g, "\n");
        const trimmed = t.trim();
        if (!trimmed) return null;

        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            try { JSON.parse(trimmed); return "json"; } catch (e) { /* not json */ }
        }

        // JSP 지시자/스크립틀릿은 HTML과 함께 등장하는 경우가 대부분이므로,
        // 존재가 확인되면 다른 언어 점수와 비교할 필요 없이 바로 JSP로 확정한다.
        if (/<%@\s*(?:page|taglib|include)/i.test(t) || /<%[=!]?[\s\S]*?%>/.test(t)) return "jsp";
        if (/<\?xml/.test(t)) return "xml";

        const lineCount = t.split("\n").length;
        const scores = {java: 0, html: 0, markdown: 0, css: 0, javascript: 0, sql: 0, python: 0, bash: 0, yaml: 0, properties: 0};

        if (/<!DOCTYPE html>/i.test(t) || /<html[\s>]/i.test(t)) scores.html += 5;
        if (/<\/?[a-zA-Z][\w-]*(?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'))?)*\s*\/?>/.test(t)) scores.html += 2;
        if (/\bpublic\s+(?:final\s+|abstract\s+)?(?:class|interface|enum)\s+\w+/.test(t)) scores.java += 5;
        if (/\bpublic\s+static\s+void\s+main\s*\(/.test(t)) scores.java += 6;
        if (/\bimport\s+java\./.test(t)) scores.java += 4;
        if (/@(?:Override|Autowired|RequestMapping|GetMapping|PostMapping|Component|Service|Repository|Entity|Test)\b/.test(t)) scores.java += 3;
        if (/\b(?:function|const|let|var)\s+\w+\s*=|=>\s*\{|\bconsole\.(?:log|error|warn)\(/.test(t)) scores.javascript += 4;
        if (/^\s*#{1,6}\s+\S/m.test(t)) scores.markdown += 4;
        if (/^\s*(?:[-*+]|\d+\.)\s+\S/m.test(t)) scores.markdown += 1;
        if (/\[[^\]\n]+\]\([^)\n]+\)/.test(t)) scores.markdown += 2;
        if (/^\s*[.#]?[\w-]+(?:\s*,\s*[.#]?[\w-]+)*\s*\{[^{}]*:[^{}]*;[^{}]*\}/m.test(t)) scores.css += 4;
        if (/\bSELECT\b[\s\S]*\bFROM\b/i.test(t)) scores.sql += 5;
        if (/\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(t)) scores.sql += 5;
        if (/\bdef\s+\w+\s*\([^)]*\)\s*:/.test(t)) scores.python += 5;
        if (/^\s*(?:import|from)\s+[\w.]+(?:\s+import\s+[\w.,* ]+)?\s*$/m.test(t) && !/;/.test(t)) scores.python += 2;
        if (/^#!\s*\/bin\/(?:ba|z)?sh/.test(t) || /\becho\s+["'$]/.test(t)) scores.bash += 3;
        if (/^[\w.-]+\s*:\s*.*$/m.test(t) && /^\s*-\s+\S/m.test(t)) scores.yaml += 3;
        if (lineCount >= 2 && /^[ \t]*[\w.]+\s*=\s*.+$/m.test(t) && !/[{};]/.test(t)) scores.properties += 1;

        let best = null, bestScore = 0;
        for (const lang in scores) {
            if (scores[lang] > bestScore) { best = lang; bestScore = scores[lang]; }
        }
        if (!best) return null;
        if (lineCount === 1 && bestScore < 5) return null;
        return bestScore >= 3 ? best : null;
    }

    // ---------- 코드 블록 -> DOM 렌더링 ----------

    function resolveLangForBlock(hint, code) {
        const normalized = normalizeLang(hint);
        if (normalized) return {lang: normalized, autoDetected: false};
        const auto = detectLanguage(code);
        return {lang: auto || "plaintext", autoDetected: true};
    }

    function formatAndHighlight(code, lang) {
        let displayCode = code;
        if (lang === "json") {
            try { displayCode = JSON.stringify(JSON.parse(code), null, 2); } catch (e) { /* keep original */ }
        }
        return {displayCode: displayCode, html: highlightCode(displayCode, lang)};
    }

    function fallbackCopy(text, cb) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
        cb();
    }

    function copyCodeToClipboard(code, button) {
        const done = () => {
            const old = button.textContent;
            button.textContent = "복사됨";
            setTimeout(() => { button.textContent = old; }, 1200);
        };
        if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(done).catch(() => fallbackCopy(code, done));
        } else {
            fallbackCopy(code, done);
        }
    }

    function appendPlainText(container, text) {
        if (!text) return;
        const span = document.createElement("span");
        span.textContent = text;
        container.appendChild(span);
    }

    function appendCodeBlock(container, code, hint) {
        const resolved = resolveLangForBlock(hint, code);
        const lang = resolved.lang;
        const autoDetected = resolved.autoDetected;
        const formatted = formatAndHighlight(code, lang);
        const displayCode = formatted.displayCode;
        const html = formatted.html;

        const wrapper = document.createElement("div");
        wrapper.className = "code-block";

        const header = document.createElement("div");
        header.className = "code-block-header";

        const label = document.createElement("span");
        label.className = "code-block-lang";
        label.textContent = languageLabel(lang) + (autoDetected && lang !== "plaintext" ? " · 자동감지" : "");

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "code-block-copy";
        copyBtn.textContent = "복사";
        copyBtn.onclick = event => {
            event.stopPropagation();
            copyCodeToClipboard(displayCode, copyBtn);
        };

        const pre = document.createElement("pre");
        const codeEl = document.createElement("code");
        codeEl.className = "language-" + lang;
        codeEl.innerHTML = html;
        pre.appendChild(codeEl);

        if (lang === "markdown") {
            // 마크다운은 "코드 형태"(원문 강조)와 "뷰 형태"(진짜 제목/목록 등으로 렌더링) 중 골라서 볼 수 있다.
            const renderedView = document.createElement("div");
            renderedView.className = "markdown-rendered";
            renderedView.innerHTML = markdownToHtml(displayCode);

            const toggleGroup = document.createElement("div");
            toggleGroup.className = "code-view-toggle";

            const viewBtn = document.createElement("button");
            viewBtn.type = "button";
            viewBtn.className = "view-toggle-btn active";
            viewBtn.textContent = "뷰";

            const sourceBtn = document.createElement("button");
            sourceBtn.type = "button";
            sourceBtn.className = "view-toggle-btn";
            sourceBtn.textContent = "코드";

            pre.classList.add("hidden");

            const setMode = mode => {
                const isRendered = mode === "rendered";
                renderedView.classList.toggle("hidden", !isRendered);
                pre.classList.toggle("hidden", isRendered);
                viewBtn.classList.toggle("active", isRendered);
                sourceBtn.classList.toggle("active", !isRendered);
            };
            viewBtn.onclick = event => { event.stopPropagation(); setMode("rendered"); };
            sourceBtn.onclick = event => { event.stopPropagation(); setMode("source"); };

            toggleGroup.append(viewBtn, sourceBtn);
            header.append(label, toggleGroup, copyBtn);
            wrapper.append(header, renderedView, pre);
        } else {
            header.append(label, copyBtn);
            wrapper.append(header, pre);
        }

        container.appendChild(wrapper);
    }

    function renderMessageContent(container, rawText) {
        while (container.firstChild) container.removeChild(container.firstChild);
        // Windows(CRLF)에서 붙여넣은 텍스트가 있어도 정규식 매칭이 흔들리지 않도록 개행을 통일한다.
        const text = String(rawText || "").replace(/\r\n/g, "\n");
        // 백틱을 3개 이상(4개 이상도 허용) 쓴 펜스를 지원하되, 여는 펜스와 닫는 펜스의
        // 백틱 개수가 서로 다르면(예: 문서에서 예시를 감싸는 4개짜리 바깥 펜스까지 함께
        // 복사해 붙여넣은 경우) 매칭되지 않도록 같은 개수만 짝짓는다(\1 역참조).
        const fenceRegex = /(`{3,})([\w+-]*)[ \t]*\n?([\s\S]*?)\1/g;
        let lastIndex = 0;
        let match;
        let found = false;

        while ((match = fenceRegex.exec(text)) !== null) {
            found = true;
            if (match.index > lastIndex) appendPlainText(container, text.slice(lastIndex, match.index));
            const hint = match[2];
            const code = match[3].replace(/\n$/, "");
            appendCodeBlock(container, code, hint);
            lastIndex = fenceRegex.lastIndex;
        }

        if (found) {
            if (lastIndex < text.length) appendPlainText(container, text.slice(lastIndex));
            return;
        }

        const autoLang = detectLanguage(text);
        if (autoLang) {
            appendCodeBlock(container, text, "");
        } else {
            appendPlainText(container, text);
        }
    }

    global.renderMessageContent = renderMessageContent;
    global.detectLanguage = detectLanguage;
    global.CodeFormat = {
        renderMessageContent: renderMessageContent,
        detectLanguage: detectLanguage,
        highlightCode: highlightCode,
        normalizeLang: normalizeLang,
        languageLabel: languageLabel,
        escapeHtml: escapeHtml,
        markdownToHtml: markdownToHtml
    };
})(typeof window !== "undefined" ? window : globalThis);

