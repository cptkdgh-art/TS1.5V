import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const sourceRoot = join(root, 'src');
const outputs = {
  json: join(root, 'docs', 'generated', 'source-map.json'),
  runtime: join(root, 'docs', 'generated', 'AI_RUNTIME_MAP.json'),
  markdown: join(root, 'docs', 'generated', 'SOURCE_MAP.md'),
};
const checkOnly = process.argv.includes('--check');

const kernelEntrypoints = [
  ['src/main.tsx', 'React runtime boot'],
  ['src/App.tsx', 'Application shell, workspace bootstrap, and top-level views'],
  ['src/@services/ai/config.ts', 'AI provider boundary and task-to-model policy'],
  ['src/@services/ai/writingContext.ts', 'Shared author, story-memory, and raw-chapter context contract'],
  ['src/@services/ai/generation.ts', 'Novel generation orchestration and context-cache use'],
  ['src/@stores/novelStore.ts', 'Atomic novel state and ordered IndexedDB persistence'],
  ['src/@stores/workspaceStore.ts', 'Workspace registry and active-workspace lifecycle'],
  ['src/@services/storage/storageNamespace.ts', 'Global versus workspace-scoped storage key boundary'],
  ['src/@services/bridge/index.ts', 'Read-only writing bridge and local command boundary'],
  ['src/@services/production-package/importer.ts', 'Selective package import, ID remap, and write locks'],
];

const runtimeFlowDefinitions = [
  {
    id: 'novel-writing',
    task: 'Stream the next novel chapter and persist the accepted result',
    model: {
      authority: 'continueNovelStream',
      file: 'src/@services/ai/generation.ts',
      selection: [
        'novel.generationEngine',
        'legacy Gemini and GLM model normalization inside continueNovelStream',
        'provider detection inside continueNovelStream',
        'MODELS.TEXT only when the novel has no usable engine',
      ],
      policyHelper: "getAiTaskModel('writing') describes the intended policy but is not called by continueNovelStream",
    },
    context: {
      authority: 'continueNovelStream',
      file: 'src/@services/ai/generation.ts',
      helpers: [
        'buildWriterSystemInstruction',
        'resolveStoryMemory',
        'buildPreviousBriefing',
        'injectUnifiedBriefing',
      ],
      diagnosticProjection: 'buildWritingContext is used by diagnostics, the Codex bridge, and Director Clio; it is not the Gemini novel-writing assembler',
    },
    cache: {
      authority: 'manageContextCache',
      file: 'src/@services/ai/caching.ts',
      behavior: 'Gemini-only summary or raw context cache selected inside continueNovelStream; xAI and GLM skip it',
    },
    retry: {
      authority: 'continueNovelStream',
      file: 'src/@services/ai/generation.ts',
      behavior: 'Up to three attempts; retryable Gemini failures may select getGeminiOverloadFallbackModel and skip cache on the next attempt',
    },
    persistence: {
      authority: 'useChapterGeneration -> onMutateNovel',
      file: 'src/@modules/editor/hooks/useChapterGeneration.ts',
      behavior: 'Success, explicit cancellation, and non-retryable error recovery merge into the latest novel state through novelStore.mutateNovel',
    },
    cancellation: {
      partialPersistence: true,
      behavior: 'The hook returns accumulated cancellation text and preserves more than 50 characters as a resumable incomplete chapter',
    },
    verifiedExports: [
      ['src/@services/ai/generation.ts', 'continueNovelStream'],
      ['src/@services/ai/prompts.ts', 'buildWriterSystemInstruction'],
      ['src/@services/ai/writingContext.ts', 'resolveStoryMemory'],
      ['src/@services/ai/historyBudget.ts', 'buildPreviousBriefing'],
      ['src/@services/ai/briefing.ts', 'injectUnifiedBriefing'],
      ['src/@services/ai/caching.ts', 'manageContextCache'],
      ['src/@services/ai/config.ts', 'getGeminiOverloadFallbackModel'],
      ['src/@modules/editor/hooks/useChapterGeneration.ts', 'useChapterGeneration'],
    ],
  },
  {
    id: 'shared-writing-context-read',
    task: 'Project saved author and story state for diagnostics and external readers',
    model: {
      authority: null,
      file: null,
      selection: ['No model is selected by this projection'],
      policyHelper: null,
    },
    context: {
      authority: 'buildWritingContext',
      file: 'src/@services/ai/writingContext.ts',
      helpers: ['resolveStoryMemory'],
      consumers: [
        'src/@modules/editor/tabs/CacheTab.tsx',
        'src/@services/bridge/index.ts',
        'src/@services/director-clio/context.ts',
      ],
    },
    cache: {
      authority: null,
      file: null,
      behavior: 'Reports saved summary and raw ranges; does not create a Gemini cache',
    },
    retry: {
      authority: null,
      file: null,
      behavior: 'Pure synchronous projection',
    },
    persistence: {
      authority: null,
      file: null,
      behavior: 'Read-only; generatedAt is the only transient field',
    },
    cancellation: {
      partialPersistence: null,
      behavior: 'Not applicable',
    },
    verifiedExports: [
      ['src/@services/ai/writingContext.ts', 'buildWritingContext'],
      ['src/@services/ai/writingContext.ts', 'resolveStoryMemory'],
    ],
  },
];

function toPosix(value) {
  return value.replaceAll('\\', '/');
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = join(directory, entry.name);
      return entry.isDirectory() ? walk(absolute) : [absolute];
    })
    .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('.d.ts'))
    .sort((a, b) => a.localeCompare(b));
}

function hasExportModifier(node) {
  return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function variableNames(declarationList) {
  return declarationList.declarations.flatMap((declaration) => {
    return ts.isIdentifier(declaration.name) ? [declaration.name.text] : [];
  });
}

function inspectFile(absolutePath) {
  const source = readFileSync(absolutePath, 'utf8');
  const file = toPosix(relative(root, absolutePath));
  const scriptKind = absolutePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
  const staticImports = [];
  const dynamicImports = [];
  const unresolvedDynamicImports = [];
  const exports = [];

  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      staticImports.push(statement.moduleSpecifier.text);
    }

    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        exports.push(...statement.exportClause.elements.map((element) => element.name.text));
      } else if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
        exports.push(`* from ${statement.moduleSpecifier.text}`);
      }
      continue;
    }

    if (!hasExportModifier(statement)) continue;

    if (
      ts.isFunctionDeclaration(statement)
      || ts.isClassDeclaration(statement)
      || ts.isInterfaceDeclaration(statement)
      || ts.isTypeAliasDeclaration(statement)
      || ts.isEnumDeclaration(statement)
    ) {
      exports.push(statement.name?.text ?? 'default');
    } else if (ts.isVariableStatement(statement)) {
      exports.push(...variableNames(statement.declarationList));
    }
  }

  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteralLike(argument)) {
        dynamicImports.push(argument.text);
      } else {
        unresolvedDynamicImports.push(argument?.getText(ast).slice(0, 120) || '(missing argument)');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);

  const uniqueStaticImports = [...new Set(staticImports)].sort();
  const uniqueDynamicImports = [...new Set(dynamicImports)].sort();
  const uniqueUnresolvedDynamicImports = [...new Set(unresolvedDynamicImports)].sort();

  const relativeToSource = toPosix(relative(sourceRoot, absolutePath));
  const segments = relativeToSource.split('/');
  const layer = segments[0].startsWith('@') ? segments[0] : '@app';
  const area = segments[0].startsWith('@') && segments.length > 2 ? segments[1] : '(root)';

  return {
    file,
    layer,
    area,
    lines: source.split(/\r?\n/).length,
    isTest: /\.test\.(ts|tsx)$/.test(file),
    imports: [...new Set([...uniqueStaticImports, ...uniqueDynamicImports])].sort(),
    staticImports: uniqueStaticImports,
    dynamicImports: uniqueDynamicImports,
    unresolvedDynamicImports: uniqueUnresolvedDynamicImports,
    exports: [...new Set(exports)].sort(),
    sha256: createHash('sha256').update(source).digest('hex').slice(0, 12),
  };
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function anchor(value) {
  return value
    .toLowerCase()
    .replaceAll('@', '')
    .replace(/[^a-z0-9가-힣 -]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function summarizeImports(file) {
  const staticInternal = file.staticImports.filter((item) => item.startsWith('@') || item.startsWith('.'));
  const dynamicInternal = file.dynamicImports.filter((item) => item.startsWith('@') || item.startsWith('.'));
  const values = [
    ...staticInternal.map((item) => `\`${escapeCell(item)}\``),
    ...dynamicInternal.map((item) => `lazy \`${escapeCell(item)}\``),
    ...file.unresolvedDynamicImports.map((item) => `lazy expression \`${escapeCell(item)}\``),
  ];
  const shown = values.slice(0, 8);
  if (values.length > shown.length) shown.push(`+${values.length - shown.length}`);
  return shown.join(', ') || '-';
}

function buildMarkdown(map) {
  const layerCounts = new Map();
  for (const file of map.files) {
    const current = layerCounts.get(file.layer) ?? { files: 0, lines: 0 };
    current.files += 1;
    current.lines += file.lines;
    layerCounts.set(file.layer, current);
  }

  const areaCounts = new Map();
  for (const file of map.files) {
    const key = `${file.layer}/${file.area}`;
    const current = areaCounts.get(key) ?? { layer: file.layer, area: file.area, files: 0, lines: 0, tests: 0 };
    current.files += 1;
    current.lines += file.lines;
    current.tests += file.isTest ? 1 : 0;
    areaCounts.set(key, current);
  }

  const largest = [...map.files].sort((a, b) => b.lines - a.lines).slice(0, 20);
  const lines = [
    '# V1.5 Generated Source Map',
    '',
    '> Generated by `npm run codemap`. Do not edit this file by hand.',
    '',
    '## Table of Contents',
    '',
    '- [How to Read This Map](#how-to-read-this-map)',
    '- [Snapshot](#snapshot)',
    '- [Layers](#layers)',
    '- [Module Areas](#module-areas)',
    '- [Kernel Entry Points](#kernel-entry-points)',
    '- [AI Runtime Flows](#ai-runtime-flows)',
    '- [Largest Files](#largest-files)',
    '- [Detailed File Inventory](#detailed-file-inventory)',
    '',
    '## How to Read This Map',
    '',
    '- Start with `docs/MAP.md` for product boundaries and document order.',
    '- Read `docs/AI_MAP.md` for runtime ownership, AI flow, storage, cache, and maintenance routes.',
    '- Use this generated inventory to locate concrete files, exports, static imports, and literal dynamic imports.',
    '- `docs/generated/AI_RUNTIME_MAP.json` records the verified novel-writing and shared-context authorities.',
    '- A passing `npm run codemap:check` proves these generated artifacts match the generator and current TypeScript source; it does not prove every runtime behavior is semantically complete.',
    '',
    '## Snapshot',
    '',
    `- TypeScript source files: ${map.summary.files}`,
    `- Source lines: ${map.summary.lines}`,
    `- Exported symbols: ${map.summary.exports}`,
    `- Static imports: ${map.summary.staticImports}`,
    `- Literal dynamic imports: ${map.summary.dynamicImports}`,
    `- Unresolved dynamic import expressions: ${map.summary.unresolvedDynamicImports}`,
    `- Unit/contract test files: ${map.summary.testFiles}`,
    '',
    '## Layers',
    '',
    '| Layer | Files | Lines |',
    '| --- | ---: | ---: |',
    ...[...layerCounts.entries()].map(([layer, stats]) => `| \`${escapeCell(layer)}\` | ${stats.files} | ${stats.lines} |`),
    '',
    '## Module Areas',
    '',
    '| Area | Files | Lines | Test Files |',
    '| --- | ---: | ---: | ---: |',
    ...[...areaCounts.values()]
      .sort((a, b) => a.layer.localeCompare(b.layer) || a.area.localeCompare(b.area))
      .map((stats) => `| \`${escapeCell(stats.layer)}/${escapeCell(stats.area)}\` | ${stats.files} | ${stats.lines} | ${stats.tests} |`),
    '',
    '## Kernel Entry Points',
    '',
    '| File | Responsibility | Lines | Lazy Imports | Exported API |',
    '| --- | --- | ---: | ---: | --- |',
    ...map.entrypoints.map((entry) => `| \`${escapeCell(entry.file)}\` | ${escapeCell(entry.responsibility)} | ${entry.lines} | ${entry.dynamicImports.length} | ${escapeCell(entry.exports.join(', ') || '-')} |`),
    '',
    '## AI Runtime Flows',
    '',
    '| Flow | Task | Model Authority | Context Authority | Persistence Authority |',
    '| --- | --- | --- | --- | --- |',
    ...map.runtimeFlowIndex.map((flow) => `| \`${escapeCell(flow.id)}\` | ${escapeCell(flow.task)} | ${escapeCell(flow.modelAuthority || '-')} | ${escapeCell(flow.contextAuthority || '-')} | ${escapeCell(flow.persistenceAuthority || '-')} |`),
    '',
    'See `docs/generated/AI_RUNTIME_MAP.json` for cache, retry, cancellation, consumers, and verified source symbols.',
    '',
    '## Largest Files',
    '',
    '| File | Lines | Exported API |',
    '| --- | ---: | --- |',
    ...largest.map((file) => `| \`${escapeCell(file.file)}\` | ${file.lines} | ${escapeCell(file.exports.join(', ') || '-')} |`),
    '',
    '## Detailed File Inventory',
    '',
    ...[...layerCounts.keys()].map((layer) => `- [${layer}](#${anchor(layer)})`),
  ];

  for (const [layer] of layerCounts) {
    lines.push('', `### ${layer}`, '', '| File | Area | Lines | Internal Dependencies | Exported API |', '| --- | --- | ---: | --- | --- |');
    for (const file of map.files.filter((candidate) => candidate.layer === layer)) {
      lines.push(`| \`${escapeCell(file.file)}\` | \`${escapeCell(file.area)}\` | ${file.lines} | ${summarizeImports(file)} | ${escapeCell(file.exports.join(', ') || '-')} |`);
    }
  }

  return `${lines.join('\n')}\n`;
}

const files = walk(sourceRoot).map(inspectFile);

function validateRuntimeFlows(definitions) {
  for (const flow of definitions) {
    for (const [file, symbol] of flow.verifiedExports) {
      const source = files.find((candidate) => candidate.file === file);
      if (!source) throw new Error(`Runtime flow ${flow.id} references a missing file: ${file}`);
      if (!source.exports.includes(symbol)) {
        throw new Error(`Runtime flow ${flow.id} references a missing export: ${file}#${symbol}`);
      }
    }
  }
}

validateRuntimeFlows(runtimeFlowDefinitions);

const entrypoints = kernelEntrypoints.flatMap(([file, responsibility]) => {
  const match = files.find((candidate) => candidate.file === file);
  return match ? [{
    file,
    responsibility,
    lines: match.lines,
    exports: match.exports,
    dynamicImports: match.dynamicImports,
    unresolvedDynamicImports: match.unresolvedDynamicImports,
  }] : [];
});
const directories = Object.values(files.reduce((result, file) => {
  const key = `${file.layer}/${file.area}`;
  const current = result[key] ?? { path: key, files: 0, lines: 0, testFiles: 0 };
  current.files += 1;
  current.lines += file.lines;
  current.testFiles += file.isTest ? 1 : 0;
  result[key] = current;
  return result;
}, {})).sort((a, b) => a.path.localeCompare(b.path));
const map = {
  schemaVersion: 3,
  sourceRoot: 'src',
  summary: {
    files: files.length,
    lines: files.reduce((sum, file) => sum + file.lines, 0),
    exports: files.reduce((sum, file) => sum + file.exports.length, 0),
    imports: files.reduce((sum, file) => sum + file.imports.length, 0),
    staticImports: files.reduce((sum, file) => sum + file.staticImports.length, 0),
    dynamicImports: files.reduce((sum, file) => sum + file.dynamicImports.length, 0),
    unresolvedDynamicImports: files.reduce((sum, file) => sum + file.unresolvedDynamicImports.length, 0),
    testFiles: files.filter((file) => file.isTest).length,
  },
  entrypoints,
  runtimeFlowIndex: runtimeFlowDefinitions.map((flow) => ({
    id: flow.id,
    task: flow.task,
    modelAuthority: flow.model.authority,
    contextAuthority: flow.context.authority,
    persistenceAuthority: flow.persistence.authority,
  })),
  directories,
  files,
};

const runtimeMap = {
  schemaVersion: 1,
  sourceMapSchemaVersion: map.schemaVersion,
  sourceRoot: map.sourceRoot,
  verification: 'Every verifiedExports reference is checked against the current TypeScript AST before generation.',
  flows: runtimeFlowDefinitions.map((flow) => ({
    ...flow,
    verifiedExports: flow.verifiedExports.map(([file, symbol]) => ({ file, symbol })),
  })),
};

const generated = {
  [outputs.json]: `${JSON.stringify(map, null, 2)}\n`,
  [outputs.runtime]: `${JSON.stringify(runtimeMap, null, 2)}\n`,
  [outputs.markdown]: buildMarkdown(map),
};

if (checkOnly) {
  const stale = Object.entries(generated)
    .filter(([file, expected]) => !existsSync(file) || readFileSync(file, 'utf8') !== expected)
    .map(([file]) => toPosix(relative(root, file)));

  if (stale.length > 0) {
    console.error(`Source map is stale: ${stale.join(', ')}`);
    console.error('Run npm run codemap and commit the generated files.');
    process.exit(1);
  }

  console.log(`Source map is current: ${map.summary.files} files, ${map.summary.lines} lines.`);
  process.exit(0);
}

for (const [file, content] of Object.entries(generated)) {
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file) || readFileSync(file, 'utf8') !== content) {
    writeFileSync(file, content, 'utf8');
  }
}

console.log(`Generated source map: ${map.summary.files} files, ${map.summary.lines} lines.`);
