# SQLsmith: контекст рефакторинга и бэклог этапов 3–6

Документ-передача контекста для продолжения архитектурного рефакторинга.
Составлен 2026-07-16 по итогам аудита и выполнения этапов 1–2.

## О проекте

pnpm-монорепо `sqlsmith` (https://github.com/shadow-identity/sqlsmith), v0.5.0:

- `packages/core` (`@sqlsmith/core`) — библиотека: парсинг `.sql` (DDL) через
  `node-sql-parser@5.3.10`, граф FK-зависимостей, топологическая сортировка
  (алгоритм Кана), слияние в один файл. Диалекты: postgresql (основной),
  sqlite (тестируется), mysql/bigquery (заявлены, не тестируются).
- `packages/cli` (`@sqlsmith/cli`) — команды `merge` (default), `info`, `validate`.
- `packages/vite-plugin` (`@sqlsmith/vite-plugin`) — пересборка merged-схемы на HMR.

Пакеты опубликованы в npm. Семейство 0.x — **ломать API можно свободно**,
без deprecated-алиасов (решение владельца).

## Рабочие соглашения (обязательны)

1. **Строгий TDD.** Сначала контрактные тесты на новое поведение через
   публичный API (SqlMerger / вывод merger'а / CLI-подпроцесс), прогон с
   фиксацией красного состояния, затем имплементация до зелёного. Тесты
   покрывают контракт, а не имплементацию; их задача — находить баги, а не
   быть вечно зелёными. Мок-тесты, проверяющие порядок внутренних вызовов, —
   антипаттерн (такие в cli уже есть исторически, новых не писать).
2. **Минимум permission-промптов**: группировать shell-шаги в один вызов.
   В `.claude/settings.json` проекта есть allowlist: `pnpm *`, `node *`,
   `git *`, `python3 *`.
3. Ветка: `refactor/io-and-statement-merge` (от `main`). Коммиты — conventional
   commits, один этап = один коммит с `BREAKING CHANGE:` где надо.
4. Верификация каждого этапа: `pnpm build && pnpm -r test`, biome чистый,
   e2e через собранный CLI (`node packages/cli/dist/cli.js ...`).

## Сделано: этапы 1–2 (коммиты `6b658bd`, `1be224e`)

### Этап 1 — вынос I/O из ядра (`6b658bd`)
- `Logger` пишет ВСЁ в stderr (`process.stderr.write` + `util.format`);
  stdout зарезервирован под результат → `sqlsmith dir > out.sql` чистый.
- `SqlFileMerger.mergeStatements` — чистая функция: возвращает строку,
  `MergeOptions.outputPath` удалён. Вывод — забота вызывающего:
  CLI (`merge-command.ts`) пишет файл при `--output`, иначе в stdout;
  vite-plugin пишет `options.output` сам.
- `process.exit` и маппинг exit-кодов перенесены из core
  (`ErrorHandler.handleCommandError` удалён) в `packages/cli/src/utils.ts`.
- `ErrorCode` стал value-экспортом core.
- Тесты исключены из tsc-сборки (`src/**/*.test.ts` в exclude) — раньше
  компилировались в dist и publish'ились в npm, а vitest гонял их дважды.

### Этап 2 — честное по-стейтментное слияние (`1be224e`)
- Новый `packages/core/src/services/sql-statement-splitter.ts`: лексический
  сплиттер по top-level `;`. Понимает `'...'` (`''`), `E'...'` (backslash),
  `"..."`, backtick, `--`, `/* */` (вложенные для pg), `$$`/`$tag$`,
  sqlite `BEGIN...END` (тела триггеров; CASE учитывается в глубине).
  Чанк = `{ leadingTrivia, text, startLine }`; lossless (конкатенация ==
  оригинал); ведущие комментарии в trivia, хвостовой same-line комментарий
  и комментарии конца файла — в text.
- `SqlFileParser.parseFile`: сплит → нормализация IDENTITY **по-чанково** →
  парсинг по-чанково (sanity: 1 чанк = 1 AST-узел, иначе громкая ошибка);
  `statement.content` = оригинальный текст чанка с комментариями;
  `orderInFile`, `lineNumber` проставляются.
- Нераспознанные процессорами чанки → `SqlStatement` типа `'raw'`
  (имя `file.sql#N`, `dependsOn: []`). Raw не попадают в граф,
  `validateNoDuplicateNames` и сортировку; после сортировки вплетаются
  (`SqlMerger.#weaveRawStatements`): за ближайшим предыдущим распознанным
  стейтментом своего файла; raw до первого распознанного — перед следующим;
  файл вообще без распознанных — хвостом вывода с logger.warn.
- `SqlFileMerger.mergeStatements` эмитит по-стейтментно: опц. шапка
  (`-- SQLsmith Output`, `-- Order: ...`), опц. per-statement комментарий
  `-- <type>: <name> (from <file>) — depends on: ...`, контент,
  автодобавление `;` (с учётом хвостовых комментариев).
- Missing FK: зависимость на имя вне входного набора →
  `DependencyError.missingDependency` (код `MISSING_DEPENDENCY`, CLI exit 3).
  Опция `allowExternalReferences` (core) / `--allow-external-references`
  (все три CLI-команды) → warning и исключение из графа.
- Rename: `allowReorderDropComments` → `validateSourceOrder` (default true),
  CLI-флаг `--no-validate-source-order`; при false вывод корректно
  переупорядочивается (комментарии едут со стейтментами).
- Удалён мёртвый код: `parseContent`, `buildFileGraph`, `sortFiles`,
  сервисный `mergeFiles`, тип `ParseResult`.
- README обновлён (флаги, stderr, exit-коды, raw passthrough).

### Баги, найденные тестами по ходу (все починены)
- **CREATE VIEW не распознавался вовсе**: парсер кладёт имя в `node.view.view`
  (объект `{db, view}`), SELECT — в `node.select`; старый процессор искал
  строку `node.view` / `node.table[0].table` и `node.definition`. Следствие:
  файлы из одних view **молча выпадали** из вывода released-версии.
  Нашёл golden-тест. Починено в `create-view-processor.ts`.
- FK из table-level constraint извлекались **дважды** (`depends on: x, x`) —
  оба if-блока в `create-table-processor.ts` срабатывали. Дедуп добавлен.
- `ServiceContainer.updateConfiguration` сбрасывал не все кэши → сервисы со
  старым logger. Теперь `#services.clear()`.

### Тестовая инфраструктура (использовать в 3–6)
- `packages/core/test/sql-statement-splitter.test.ts` — контракт сплиттера.
- `packages/core/test/statement-merge.contract.test.ts` — interleaved-порядок,
  raw, IDENTITY, комментарии, missing FK, validateSourceOrder, дедуп deps.
- `packages/core/test/golden-output.test.ts` — data-driven: для каждого
  `test/fixtures/<dialect>/correct/<scenario>` с соседним
  `<scenario>.expected.sql` сравнивает нормализованный (без комментариев,
  схлопнутые пробелы) вывод merge с golden. **Golden-файлы авторитетны.**
- `packages/core/test/sql-file-merger.contract.test.ts` — отсутствие side
  effects у merge.
- `packages/cli/src/cli.e2e.test.ts` — подпроцессные тесты собранного CLI:
  чистота stdout, stderr-логи, exit-коды, порядок, флаги. Требует `pnpm build`.
- `packages/cli/src/utils.exit-codes.test.ts` — контракт exit-кодов:
  2 файловые / 3 зависимости / 4 конфигурация / 1 прочее.
- Фикстуры: `interleaved_dependencies` (pg+sqlite), `raw_statements`,
  `identity_columns`, `comments_travel`, `invalid/missing_dependency`
  (+ `.expected.json` с `messagePattern` для data-driven invalid-тестов).

### Проверенные факты об окружении
- `node-sql-parser@5.3.10`: `parseOptions.includeLocations` фактически НЕ
  работает для postgresql/sqlite (loc нет на create-узлах) — поэтому свой
  сплиттер. INSERT/CREATE INDEX/ALTER TABLE парсятся в pg (годятся как raw);
  `COMMENT ON` в sqlite НЕ парсится (parse error, не raw!).
- Upstream FIXME: IDENTITY-нормализация регэкспом должна уйти после
  https://github.com/taozhi8833998/node-sql-parser/issues/2518 (5.3.12).

---

## План выполнения: этапы 3–6

Актуальный статус требований и тестовых трасс хранится в
`docs/refactoring-plan.matrix.json` и проверяется командой
`pnpm check:refactoring-plan`. Выполненные этапы переводят свои трассы из
`planned` в `executable` только после полного зелёного прогона.

### Порядок и границы коммитов

```text
3 (errors) → 4 (pipeline) → 5 (Vite)
                         └→ 6a (identifiers) → 6b (view deps) → 6c (dialects)
```

- Этапы выполнять последовательно, один этап/подэтап — один conventional
  commit. Этапы 3 и 4 можно делать в одной рабочей сессии, но не объединять в
  один коммит: сначала нужна стабильная граница ошибок, затем замена pipeline.
- Этап 5 зависит от 4: плагину нужны единый `MergePlan` и честная инъекция
  logger. Этап 6 тоже делать после 4, чтобы не переносить новую модель через
  удаляемый container/API.
- 6a, 6b и 6c — отдельные коммиты. Это три независимо проверяемых риска:
  идентичность объектов, обход SELECT AST и достоверность multi-dialect API.

### Решения, уже принятые планом

1. Exit-коды CLI: `1` — syntax/processing/internal/unexpected, `2` —
   filesystem/input/output I/O, `3` — dependency/order, `4` — configuration.
   Поэтому `INVALID_SQL_SYNTAX` остаётся exit 1, а
   `INVALID_STATEMENT_ORDER` становится exit 3.
2. Core не логирует исключения. Ошибка логируется ровно один раз владельцем
   внешней границы: CLI, Vite plugin или приложение-потребитель API.
3. Основной API после этапа 4: `planDirectory`/`planFiles` создают один
   `MergePlan`, `merge(plan)` только эмитит SQL. Info и validate используют тот
   же plan, а presentation живёт в CLI.
4. Рекурсивный discovery становится общей опцией core. CLI сохраняет плоский
   default для совместимости; Vite plugin использует `recursive: true`, как и
   его прежний watcher.
5. В PostgreSQL ключ объекта строится в общем relation namespace по
   каноническим schema/name. Тип statement остаётся метаданными, но не частью
   ключа: table, sequence и view с одинаковым schema/name должны считаться
   конфликтом, а не разными узлами. Это соответствует
   [документации PostgreSQL](https://www.postgresql.org/docs/current/ddl-schemas.html).
6. Unquoted PostgreSQL identifiers приводятся к lowercase, quoted сохраняют
   регистр. `node-sql-parser@5.3.10` в локальной проверке теряет сам факт
   quoting, поэтому 6a включает маленький lexer по исходному чанку; выводить
   quoted/unquoted семантику только из AST нельзя.
7. Для PostgreSQL неквалифицированные relation names получают настраиваемую
   `defaultSchema` (`public` по умолчанию). `SET search_path` остаётся явно
   задокументированным ограничением и не интерпретируется как raw statement.

## Общий TDD-протокол для каждого этапа

1. Выбрать связанные requirement/case IDs из traceability-матрицы.
2. Добавить контрактный тест через публичную границу и записать RED-команду и
   ожидаемую причину падения в сообщении коммита/рабочем журнале.
3. Запустить `pnpm check:refactoring-plan`: guard должен быть зелёным даже
   когда новый behavior-тест красный.
4. Сделать минимальную реализацию до GREEN, затем удалить заменённый код и
   только после этого рефакторить.
5. Запустить targeted suite, затем полный build/test/Biome и ручной CLI e2e.
6. Обновить status trace из `planned` в `executable`; тест должен содержать
   case ID, чтобы guard обнаруживал устаревшие или потерянные связи.

---

## Этап 3 — типизированные ошибки и одна граница логирования

**Статус: completed.** Все C3-трассы executable; полный workspace
build/test/Biome и traceability guard зелёные.

### Требования

- **R3-01 (P0):** все ожидаемые filesystem, parsing, configuration,
  dependency и processing failures выходят из core как конкретный
  `SqlMergerError`, а не голый `Error`.
- **R3-02 (P0):** parse failure содержит `filePath`, `lineNumber`, исходную
  ошибку и сохраняет cause/context; ошибка чтения/записи содержит operation и
  path.
- **R3-03 (P0):** полный маппинг `ErrorCode → CLI exit code` соответствует
  таблице 1/2/3/4 выше; неизвестный error остаётся exit 1.
- **R3-04 (P0):** одно падение создаёт ровно одну диагностическую запись в
  stderr на CLI/Vite boundary; programmatic core API сам ошибку не печатает.
- **R3-05 (P1):** `ErrorHandler`, оба wrapper-метода и комментарий «already
  logged by core» удалены; вложенные `validate → parse` больше не образуют
  цепочку catch/log/rethrow.
- **R3-06 (P1):** существующие stdout, golden output и dependency contracts не
  меняются.

### RED — тесты до реализации

- Новый `packages/core/test/error-contract.test.ts`:
  битый второй/третий чанк → `ParsingError(INVALID_SQL_SYNTAX)` с точной
  стартовой строкой; missing file/read failure → `FileSystemError`; исключение
  custom processor → `ProcessingError` с processor/file/line context.
- Расширить `packages/core/test/file-system-validator.test.ts`: убрать skipped
  cases, проверять классы/codes для missing directory, not-a-directory,
  unreadable directory, no SQL, invalid output parent и invalid dialect.
- Таблично расширить `packages/cli/src/utils.exit-codes.test.ts` всеми codes,
  особенно `INVALID_OUTPUT_PATH`, `INVALID_SQL_SYNTAX`,
  `INVALID_STATEMENT_ORDER`, `INVALID_OPTIONS`.
- Расширить `packages/cli/src/cli.e2e.test.ts` реальными temp fixtures:
  malformed SQL → 1; missing/not-directory/empty/output write failure → 2;
  cycle/missing dependency/source order → 3; invalid dialect → 4. Для каждого
  sentinel сообщения встречается в stderr ровно один раз, stdout пуст.
- Один API-кейс с `logLevel: error` доказывает, что caught `ParsingError` не
  пишет в stderr до передачи наружу.

### GREEN/REFACTOR — реализация

1. Дополнить `FileSystemError` фабриками для not-a-directory,
   unreadable/read/write failures; `ConfigurationError` использовать для
   dialect/options; `ProcessingError` — для processor и внутренних invariant
   failures. Не оборачивать уже типизированную ошибку повторно.
2. В `SqlFileParser` отдельно переводить `readdir/stat/readFile`, parser
   syntax error и нарушение «один чанк = один AST node». Parse error получает
   `chunk.startLine`; processor error получает имя processor.
3. В `FileSystemValidator` убрать двойной `readdirSync` и catch, который сейчас
   перехватывает собственное `No SQL files`; один проход возвращает ровно один
   типизированный результат.
4. В CLI сделать `handleCommandError` единственным местом format/log/exit.
   Для `SqlMergerError` печатать `getDetailedMessage()`, для неизвестного —
   безопасное message. Ошибки записи output переводить в `FileSystemError`.
5. Удалить `services/error-handler.ts`, export и все wrappers/catch-rethrow в
   `SqlMerger`, `validate-command.ts` и других командах.
6. Обновить README с окончательной таблицей exit-кодов и форматом context.

### Definition of done этапа 3

- Все C3-* traces в matrix executable и зелёные.
- `rg -n "new Error|ErrorHandler|wrapWith" packages/core/src` оставляет только
  явно допустимый internal/unexpected случай либо пустой результат; каждый
  остаток прокомментирован в плане. Допустимые остатки: нормализация
  `unknown` в `cause` у filesystem/parser boundaries и внутренний cause для
  invariant «один SQL chunk = один AST node»; наружу они всегда выходят внутри
  конкретного `SqlMergerError`. `services/logger.test.ts` содержит только
  тестовый sentinel для неизвестного имени метода.
- Один и тот же sentinel не повторяется в stderr; stdout остаётся чистым.
- Коммит: `refactor(core)!: establish typed error boundaries` с
  `BREAKING CHANGE:` об удалении `ErrorHandler`, если он остаётся публичным к
  началу этапа.

---

## Этап 4 — удалить ServiceContainer и ввести единый MergePlan pipeline

**Статус: completed.** Все C4-трассы executable; core/CLI consumers и Vite
call site используют `planDirectory → merge(plan)`, container-centric API и
presentation из core удалены.

### Целевой публичный API

```ts
const merger = new SqlMerger(options, dependencies); // dependencies optional
const plan = merger.planDirectory(input, dialect, { recursive: false });
const sql = merger.merge(plan, mergeOptions);

// Для уже разобранных файлов:
const inMemoryPlan = merger.planFiles(files);
```

`MergePlan` — readonly value с `files`, распознанными statements, единственным
`graph`, topologically ordered statements (уже с вплетёнными raw), а также
структурированными diagnostics. Создание plan выполняет parse → duplicate/
source-order validation → graph → missing refs → cycle/sort → raw weave.
`merge(plan)` не анализирует и не строит граф повторно.

### Требования

- **R4-01 (P0):** `SqlMerger` собирается обычным constructor с defaults и
  optional typed dependencies; `ServiceContainer`, `ServiceConfiguration`,
  `withContainer`, `getContainer`, `updateConfiguration`, `clone` удалены.
- **R4-02 (P0):** одна команда строит один graph и переиспользует один
  `MergePlan` для validate/info/merge; `merge(plan)` не может обойти анализ.
- **R4-03 (P0):** цикл на любом публичном пути plan/merge даёт
  `DependencyError(CIRCULAR_DEPENDENCY)`, а не generic Kahn error.
- **R4-04 (P0):** core не печатает dependency graph/progress presentation по
  умолчанию; info/validate formatting принадлежит CLI и использует plan data.
- **R4-05 (P0):** merge/info/validate сохраняют stdout/stderr и exit contracts
  этапов 1–3, включая external-reference и raw diagnostics.
- **R4-06 (P1):** все существующие golden/statement contracts проходят через
  новый pipeline без изменения SQL.
- **R4-07 (P1):** public extension points намеренны: custom processors и
  logger остаются; concrete analyzer/sorter/emitter становятся internal, если
  они не нужны typed dependency seam.

### RED — тесты до реализации

- `packages/core/test/merge-plan.contract.test.ts`:
  `planDirectory` возвращает files/graph/order/diagnostics; `merge(plan)` даёт
  golden output; injected counting analyzer фиксирует ровно один build graph
  (это architecture invariant, не проверка порядка мок-вызовов).
- Тот же contract создаёт plan из cyclic in-memory files и cyclic fixture и
  получает один typed cycle error.
- Capturing logger: обычный `planDirectory` не содержит заголовков
  `Dependency Graph`/`Topological Sort`; diagnostic data при этом доступна.
- CLI e2e для всех трёх команд подтверждает, что каждая использует один
  pipeline result и сохраняет прежнее пользовательское представление.
- Compile-time/API tests больше не импортируют container; старые тесты,
  закрепляющие строки внутренних вызовов CLI, удалить или переписать как
  subprocess/observable-output tests.

### GREEN/REFACTOR — реализация

1. Ввести `MergePlan`, `MergeDiagnostic`, `SqlMergerDependencies` и один
   normalization options path. Defaults создаются прямыми constructor calls.
2. Разделить parsing (без графа) и planning. Перенести duplicate/source-order,
   external refs, sort и raw weave в `planFiles`; `planDirectory` только
   compose discovery/parse + `planFiles`.
3. Сделать Kahn единственной пользовательской cycle boundary: при неполной
   сортировке восстановить cycle path и бросить `DependencyError`. Отдельный
   предварительный DFS убрать; defensive impossible-state остаётся
   `ProcessingError(INTERNAL_ERROR)`.
4. `DependencyAnalyzer` возвращает diagnostics вместо presentation logs.
   Renderer dependency graph/recommended order/validation summary перенести в
   CLI. Core logger используется только для явно запрошенного debug либо
   заменяется diagnostics полностью.
5. Перевести CLI команды и Vite call site на обычный `new SqlMerger({...})`.
6. Удалить container/error-handler files, exports и container-centric tests.
   Сверить `packages/core/package.json` subpath exports: не оставлять ссылки на
   несуществующие service indexes.
7. Обновить root/core README на `planDirectory → merge(plan)` и перечислить
   breaking removals без deprecated aliases.

### Definition of done этапа 4

- Все C4-* traces executable; graph build counter = 1 для merge/info/validate.
- `rg -n "ServiceContainer|withContainer|getContainer|detectCycles" packages`
  не находит production usage.
- Programmatic planning не печатает presentation; CLI info всё ещё показывает
  graph/order в stderr.
- Коммит: `refactor(core)!: replace service container with merge plans`.

---

## Этап 5 — контракт и надёжность Vite plugin

### Требования

- **R5-01 (P0):** у `@sqlsmith/vite-plugin` есть собственный Vitest suite и
  test script, входящий в `pnpm -r test`.
- **R5-02 (P0):** plugin и core используют один discovery contract;
  nested `.sql` реально попадают и в watcher, и в `MergePlan`.
- **R5-03 (P0):** `silent` выключает только логи, но не generation;
  error/normal/verbose больше не маппятся отдельной несовместимой системой,
  один logger/config передаётся plugin → core.
- **R5-04 (P0):** path containment не принимает sibling `input-other`; output
  внутри input исключается из discovery/watch и не начинает self-merge loop.
- **R5-05 (P0):** create/update/delete вложенного SQL запускают ровно одну
  полную rediscovery/generation; удаление не ждёт изменения другого файла.
- **R5-06 (P0):** невалидная новая схема не портит последний корректный output;
  build падает через Vite boundary, dev сообщает ошибку, temp output очищается.
- **R5-07 (P1):** peer dependency и тестовая версия Vite согласованы; README
  описывает реальный log/watch/error contract.

### RED — тесты до реализации

Добавить `packages/vite-plugin/src/index.test.ts` с temp directories и fake
`PluginContext`:

- `buildStart` при `logLevel: silent` создаёт непустой output и не пишет logger;
- nested parent/child fixture даёт правильный order и оба файла регистрируются;
- `input-other/x.sql` игнорируется, `input/sub/x.sql` принимается;
- output `input/generated/schema.sql` не становится новым input;
- table-driven `watchChange` для create/update/delete пересобирает результат;
- malformed update сохраняет byte-for-byte последний good output и вызывает
  Vite error один раз;
- build mode rethrows typed failure; watch mode не скрывает failure за silent;
- log levels доходят до core diagnostics без дублирования.

Отдельный integration smoke запускает Vite build с минимальным config. Реальный
dev server нужен только для одного HMR smoke; если он запускается, соблюдать
правило attached PTY, сообщить `session_id` и завершить Ctrl-C в той же сессии.

### GREEN/REFACTOR — реализация

1. Добавить Vitest dependency/config/script пакета.
2. Удалить локальный `discoverSqlFiles`: generation вызывает
   `merger.planDirectory(input, dialect, { recursive: true, exclude: [output] })`
   и регистрирует `plan.files` плюс input root.
3. Использовать один общий `LogLevel`, расширенный честным `silent` (никаких
   error logs от SQLsmith); Vite build failure при этом всё равно остаётся
   failure, а не «логом».
4. Заменить mutable options и `startsWith` на заранее resolved immutable paths
   и `relative(root, candidate)` + проверку `..`/absolute.
5. Использовать `watchChange(id, { event: create|update|delete })` как единый
   event path; каждый event делает full rediscovery, поэтому tracking array и
   отложенный delete detection не нужны.
6. Сначала полностью plan/merge в памяти, затем atomic write temp → rename.
   При failure не менять last good output и удалить temp.
7. Выбрать и закрепить поддерживаемую Vite major matrix: текущий devDependency
   уже Vite 6, тогда как peer объявляет только 4/5. Либо добавить 6 после
   smoke, либо выровнять devDependency; рассинхрон не оставлять.

### Definition of done этапа 5

- Все C5-* traces executable, package test реально выполняется в recursive run.
- Silent build создаёт тот же SQL, что info/debug; отличается только stderr.
- Create/update/delete nested файла проверены hook tests; malformed update не
  меняет output.
- Коммит: `fix(vite-plugin)!: align discovery logging and watch lifecycle`.

---

## Этап 6a — каноническая модель relation identifiers

### Коррекция исходного аудита

`Dependency.type` не надо механически добавлять в ключ. PostgreSQL требует,
чтобы tables, sequences, indexes, views, materialized views и foreign tables в
одной schema имели разные имена. Значит, нужен namespace kind (`relation`) и
канонический identifier, а `StatementType` остаётся описанием узла. Иначе
`table public.users` + `view public.users` ошибочно станут допустимыми.

### Требования

- **R6A-01 (P0):** declaration/reference представлены структурой identifier с
  schema/name, исходным display и quoting metadata; SQL content остаётся
  lossless.
- **R6A-02 (P0):** PostgreSQL normalization: unquoted lowercase, quoted exact;
  unqualified names получают configurable `defaultSchema`.
- **R6A-03 (P0):** graph key не собирается неоднозначной конкатенацией через
  точку: `"a.b"` и `a.b` различаются; namespace kind + canonical parts дают
  стабильный collision-safe key.
- **R6A-04 (P0):** duplicate, missing dependency, self-reference,
  source-order, graph, comments и diagnostics используют один key/display
  contract.
- **R6A-05 (P0):** relation types в одной schema/name конфликтуют, одинаковые
  names в разных schemas не конфликтуют.
- **R6A-06 (P1):** quoting извлекается из исходного statement chunk небольшим
  lexer, поскольку AST parser quoting не сохраняет; lexer покрывает doubled
  quotes и dots внутри quoted identifier.

### RED — fixtures и contracts

Добавить PostgreSQL correct/invalid scenarios с golden output:

- `public.users` и `audit.users` одновременно;
- FK `audit.orders → public.users` и unqualified FK через `defaultSchema`;
- `users`, `USERS`, `"users"` как один PostgreSQL object;
- `users` и `"Users"` как разные objects;
- `"tenant.one"."Users"` без смешения с `tenant.one.Users`;
- same schema table/view и table/sequence → duplicate relation error;
- self-reference с quoted/schema-qualified name;
- missing dependency error показывает display name, но context содержит key.

API contract отдельно фиксирует immutable identifier fields и гарантирует, что
исходный SQL/комментарии не переписываются.

### GREEN/REFACTOR — реализация

1. Ввести `IdentifierPart`, `RelationIdentifier`, `RelationKey` и
   dialect-specific `IdentifierRules`. Key — сериализованный tuple
   namespace/schema/name, не display string.
2. Расширить processor context исходным chunk/dialect/rules; не заставлять
   каждый processor заново лексить строку.
3. Реализовать targeted relation-name lexer для CREATE TABLE/VIEW/SEQUENCE и
   REFERENCES, пропуская comments/strings и сохраняя quoted tokens.
4. Перевести processors, graph maps, duplicate/missing/source-order checks,
   sorter и merge comments на identifier/key. Голые `statement.name` и
   `dependency.name` удалить либо оставить только как computed display API.
5. Добавить `defaultSchema` в core/CLI/plugin options и документацию; явно
   указать, что runtime `search_path` из `SET` не моделируется.

### Definition of done 6a

- Все C6A-* traces executable; schema/case/quote fixtures зелёные.
- В graph/analyzer/sorter нет `Map<string, ...>` по display name; используется
  `RelationKey`.
- PostgreSQL output lossless относительно input statement content.
- Коммит: `feat(core)!: model schema-qualified relation identifiers`.

---

## Этап 6b — полные dependencies для views

### Требования

- **R6B-01 (P0):** view dependencies собираются из JOIN, derived table,
  scalar/EXISTS subquery и set-operation branches, а не только top-level FROM.
- **R6B-02 (P0):** CTE aliases не считаются внешними relations; dependencies
  внутри CTE body учитываются, включая цепочки и recursive self alias.
- **R6B-03 (P0):** view может зависеть от table или другой view через общий
  relation key; повторные ссылки дедуплицируются.
- **R6B-04 (P1):** обход SELECT AST изолирован и exhaustive для известных форм;
  неизвестная форма не молча теряет relation, а даёт diagnostic/typed error по
  выбранной policy.

### RED — fixtures и contracts

- View над JOIN двух schemas.
- View над derived table и scalar/EXISTS subquery.
- Один и несколько CTE: CTE alias отсутствует в graph, underlying tables есть.
- Recursive CTE не создаёт missing external reference на собственный alias.
- View → view → table сортируется table, затем base view, затем dependent view.
- UNION/UNION ALL branches и повторные ссылки дают полный дедуплицированный set.

### GREEN/REFACTOR — реализация

1. Вынести `collectSelectRelations(select, scope)`; scope хранит CTE aliases.
2. Сначала зарегистрировать aliases текущего WITH, затем обойти CTE bodies и
   основной SELECT; direct FROM alias фильтровать, nested `expr.ast`, query
   expressions и set branches обходить рекурсивно.
3. Возвращать `Set<RelationKey>` + display metadata и использовать общую
   identifier normalization 6a.
4. Не делать generic object walk без scope: он легко превращает CTE alias в
   ложную внешнюю dependency.

### Definition of done 6b

- Все C6B-* traces executable; новые view goldens зелёные.
- Ни один CTE alias не попадает в missing-dependency error.
- Коммит: `fix(core)!: resolve nested view dependencies`.

---

## Этап 6c — честный контракт поддерживаемых диалектов

### Требования

- **R6C-01 (P0):** для каждого advertised dialect есть capability matrix:
  quote syntax, case folding, default namespace/schema, CREATE TABLE, FK,
  VIEW и доступные sequence semantics.
- **R6C-02 (P0):** `SqlDialect`, CLI choices, plugin type и README берутся из
  одного supported registry; непроверенный dialect не рекламируется.
- **R6C-03 (P0):** каждый оставшийся supported dialect имеет parse/order/golden
  fixtures минимум для base table, FK, duplicate/missing и view dependency.
- **R6C-04 (P1):** dialect-specific AST различия локализованы в adapter/rules,
  а не размазаны условными ветками по processors.

### Решающий тест и policy

Сначала добавить data-driven smoke для PostgreSQL, SQLite, MySQL и BigQuery на
реальном `node-sql-parser@5.3.10`. PostgreSQL и SQLite — обязательный baseline.
MySQL/BigQuery остаются в public union только если весь P0 capability subset
получает contracts в этом этапе. Если для них нужен отдельный большой parser
слой, удалить их из CLI/plugin/README и перенести поддержку в новый backlog —
не оставлять «заявлено, но не тестируется».

### GREEN/REFACTOR — реализация

1. Ввести registry `SUPPORTED_DIALECTS` и `DialectRules`; validation и типы
   должны ссылаться на него.
2. Добавить dialect adapters для AST relation/ref/view shapes и identifier
   rules только для прошедших capability gate.
3. Добавить fixtures/goldens и README matrix с конкретными ограничениями.
4. Удалить старые общие заявления «works across all SQL dialects», если они не
   подтверждены executable cases.

### Definition of done 6c / конец программы

- Все C6C-* traces executable; нет advertised dialect без P0 fixtures.
- Все требования R3-*…R6C-* имеют case и executable trace, guard сообщает
  `unmapped=0`, `unused=0`.
- Полный build/test/Biome зелёный; root/core/plugin README соответствуют API.
- Коммит: `refactor(core)!: enforce dialect capability contracts`.

## Команды верификации

```bash
pnpm check:refactoring-plan
pnpm check:refactoring-plan:complete    # должен пройти только в конце 6c
node --check scripts/check-refactoring-plan.mjs
pnpm build                         # до CLI e2e
pnpm -r test                       # после этапа 5 включает vite-plugin
pnpm exec biome check packages
node packages/cli/dist/cli.js <fixtures-dir> > /tmp/out.sql
```

Фикстуры: `packages/core/test/fixtures/{dialect}/{correct,invalid}/...`
(каталог сценария + `<scenario>.expected.sql`/`.expected.json`). Новые correct
goldens остаются авторитетными для состава и порядка SQL; unit tests не могут
заменять golden/subprocess contracts.
