import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const matrixPath = resolve(root, 'docs/refactoring-plan.matrix.json');
const requireExecutable = process.argv.includes('--require-executable');
const failures = [];

const fail = (message) => {
	failures.push(message);
};

const isNonEmptyString = (value) =>
	typeof value === 'string' && value.trim().length > 0;

const findDuplicates = (values) => {
	const seen = new Set();
	const duplicates = new Set();
	for (const value of values) {
		if (seen.has(value)) duplicates.add(value);
		seen.add(value);
	}
	return [...duplicates];
};

if (!existsSync(matrixPath)) {
	console.error(`Traceability matrix is missing: ${matrixPath}`);
	process.exit(1);
}

let matrix;
try {
	matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
} catch (error) {
	console.error(
		`Traceability matrix is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exit(1);
}

const requirements = Array.isArray(matrix.requirements)
	? matrix.requirements
	: [];
const cases = Array.isArray(matrix.cases) ? matrix.cases : [];
const traces = Array.isArray(matrix.traces) ? matrix.traces : [];
const boundaries = Array.isArray(matrix.boundaries) ? matrix.boundaries : [];
const priorities = new Set(
	Array.isArray(matrix.priorities) ? matrix.priorities : [],
);
const acceptanceCaseIds = Array.isArray(matrix.acceptance?.caseIds)
	? matrix.acceptance.caseIds
	: [];

if (!isNonEmptyString(matrix.planPath)) {
	fail('planPath must be a non-empty string');
}

const planPath = isNonEmptyString(matrix.planPath)
	? resolve(root, matrix.planPath)
	: undefined;
if (planPath && !existsSync(planPath)) {
	fail(`planPath does not exist: ${matrix.planPath}`);
}
const planContent = planPath && existsSync(planPath)
	? readFileSync(planPath, 'utf8')
	: '';

for (const [label, values] of [
	['requirement', requirements.map(({ id }) => id)],
	['case', cases.map(({ id }) => id)],
	['trace', traces.map(({ id }) => id)],
	['boundary', boundaries],
	['acceptance case', acceptanceCaseIds],
]) {
	const invalid = values.filter((value) => !isNonEmptyString(value));
	if (invalid.length > 0) fail(`${label} IDs must be non-empty`);
	const duplicates = findDuplicates(values);
	if (duplicates.length > 0) {
		fail(`duplicate ${label} IDs: ${duplicates.join(', ')}`);
	}
}

const requirementById = new Map(requirements.map((item) => [item.id, item]));
const caseById = new Map(cases.map((item) => [item.id, item]));
const traceById = new Map(traces.map((item) => [item.id, item]));
const boundarySet = new Set(boundaries);

for (const requirement of requirements) {
	if (!isNonEmptyString(requirement.stage)) {
		fail(`${requirement.id}: stage must be non-empty`);
	}
	if (!priorities.has(requirement.priority)) {
		fail(`${requirement.id}: unsupported priority ${String(requirement.priority)}`);
	}
	if (!isNonEmptyString(requirement.description)) {
		fail(`${requirement.id}: description must be non-empty`);
	}
	if (!planContent.includes(requirement.id)) {
		fail(`${requirement.id}: not declared in ${matrix.planPath}`);
	}
}

const caseIdsByRequirement = new Map();
for (const testCase of cases) {
	if (!Array.isArray(testCase.requirementIds) || testCase.requirementIds.length === 0) {
		fail(`${testCase.id}: requirementIds must not be empty`);
	} else {
		for (const requirementId of testCase.requirementIds) {
			if (!requirementById.has(requirementId)) {
				fail(`${testCase.id}: unknown requirement ${requirementId}`);
				continue;
			}
			const mapped = caseIdsByRequirement.get(requirementId) ?? [];
			mapped.push(testCase.id);
			caseIdsByRequirement.set(requirementId, mapped);
		}
	}

	if (!boundarySet.has(testCase.boundary)) {
		fail(`${testCase.id}: unsupported boundary ${String(testCase.boundary)}`);
	}
	if (!isNonEmptyString(testCase.expected)) {
		fail(`${testCase.id}: boundary must have a non-empty expected result`);
	}
	if (!isNonEmptyString(testCase.traceId) || !traceById.has(testCase.traceId)) {
		fail(`${testCase.id}: traceId must reference a known trace`);
	}
}

for (const requirement of requirements) {
	const mappedCases = caseIdsByRequirement.get(requirement.id) ?? [];
	if (mappedCases.length === 0) {
		fail(`${requirement.id}: requirement has no case`);
	}
}

for (const trace of traces) {
	if (!Array.isArray(trace.caseIds) || trace.caseIds.length === 0) {
		fail(`${trace.id}: caseIds must not be empty`);
	}
	for (const caseId of trace.caseIds ?? []) {
		const testCase = caseById.get(caseId);
		if (!testCase) {
			fail(`${trace.id}: unknown case ${caseId}`);
			continue;
		}
		if (testCase.traceId !== trace.id) {
			fail(`${trace.id}: ${caseId} points to ${testCase.traceId}`);
		}
	}

	if (!isNonEmptyString(trace.path)) {
		fail(`${trace.id}: path must be non-empty`);
	}
	if (!['planned', 'executable'].includes(trace.status)) {
		fail(`${trace.id}: unsupported status ${String(trace.status)}`);
		continue;
	}

	if (trace.status === 'planned') {
		if (!isNonEmptyString(trace.pendingReason)) {
			fail(`${trace.id}: planned trace requires pendingReason`);
		}
		if (requireExecutable) {
			fail(`${trace.id}: trace is still planned`);
		}
		continue;
	}

	const executablePath = resolve(root, trace.path);
	if (!existsSync(executablePath)) {
		fail(`${trace.id}: executable trace path does not exist: ${trace.path}`);
		continue;
	}
	const executableContent = readFileSync(executablePath, 'utf8');
	const referencedIds = new Set(trace.caseIds);
	for (const caseId of trace.caseIds) {
		const testCase = caseById.get(caseId);
		for (const requirementId of testCase?.requirementIds ?? []) {
			referencedIds.add(requirementId);
		}
	}
	if (![...referencedIds].some((id) => executableContent.includes(id))) {
		fail(
			`${trace.id}: executable trace must mention a mapped case or requirement ID`,
		);
	}
}

const acceptedCases = new Set(acceptanceCaseIds);
for (const caseId of acceptanceCaseIds) {
	if (!caseById.has(caseId)) fail(`acceptance: unknown case ${caseId}`);
}
const unusedCases = cases
	.map(({ id }) => id)
	.filter((caseId) => !acceptedCases.has(caseId));
if (unusedCases.length > 0) {
	fail(`cases unused by acceptance: ${unusedCases.join(', ')}`);
}

const referencedTraceIds = new Set(cases.map(({ traceId }) => traceId));
const unusedTraces = traces
	.map(({ id }) => id)
	.filter((traceId) => !referencedTraceIds.has(traceId));
if (unusedTraces.length > 0) {
	fail(`traces unused by cases: ${unusedTraces.join(', ')}`);
}

const unmappedRequirements = requirements.filter(
	({ id }) => (caseIdsByRequirement.get(id) ?? []).length === 0,
);
const plannedTraces = traces.filter(({ status }) => status === 'planned');
const guardResult = failures.length === 0 ? 'PASS' : 'FAIL';

console.log(
	[
		`requirements=${requirements.length}`,
		`cases=${cases.length}`,
		`traces/tests=${traces.length}`,
		`unmapped=${unmappedRequirements.length}`,
		`unused=${unusedCases.length + unusedTraces.length}`,
		`planned=${plannedTraces.length}`,
		`guard=${guardResult}`,
		'behavior=separate',
	].join(' '),
);

if (failures.length > 0) {
	for (const failure of failures) console.error(`- ${failure}`);
	process.exitCode = 1;
}
