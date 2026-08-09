import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const specsDirectory = path.join(repositoryRoot, "specs");
const templatePath = path.join(specsDirectory, "_template", "spec.md");
const allowedStatuses = new Set(["Draft", "Approved", "In Progress", "Implemented", "Verified", "Superseded"]);
const replacementStatuses = new Set(["Approved", "In Progress", "Implemented", "Verified"]);
const requiredSections = [
    "Problem",
    "Desired outcome",
    "Scope",
    "Non-goals",
    "Functional requirements",
    "Non-functional requirements",
    "Acceptance scenarios",
    "Interfaces and data",
    "Compatibility and rollout",
    "Related specifications and conflicts",
    "Open questions and assumptions",
    "Implementation notes",
    "Verification matrix",
    "Verification commands",
    "Completion checklist",
];

const errors = [];
const specifications = [];

function matches(text, expression) {
    return expression.test(text.replaceAll("\r\n", "\n"));
}

function metadataValue(text, label, relativePath) {
    const match = text.match(new RegExp(`^${label}:\\s*(.*?)\\s*$`, "m"));
    if (!match) {
        errors.push(`${relativePath}: missing "${label}" metadata.`);
        return null;
    }
    return match[1].trim();
}

function referenceIds(value, label, relativePath) {
    if (value === null || value === "None") {
        return [];
    }
    const ids = [...value.matchAll(/\bSPEC-(\d{4})\b/g)].map((match) => `SPEC-${match[1]}`);
    const residue = value.replaceAll(/\bSPEC-\d{4}\b/g, "").replaceAll(/[\s,]/g, "");
    if (ids.length === 0 || residue.length > 0) {
        errors.push(`${relativePath}: ${label} must be "None" or a comma-separated list of SPEC-NNNN IDs.`);
    }
    if (new Set(ids).size !== ids.length) {
        errors.push(`${relativePath}: ${label} cannot contain duplicate IDs.`);
    }
    return [...new Set(ids)];
}

function validateDocument(filePath, directoryId, isTemplate = false) {
    const relativePath = path.relative(repositoryRoot, filePath);
    const text = fs.readFileSync(filePath, "utf8");
    const expectedId = isTemplate ? "0000" : directoryId;

    if (!matches(text, new RegExp(`^# SPEC-${expectedId}: \\S.+$`, "m"))) {
        errors.push(`${relativePath}: title must start with "# SPEC-${expectedId}: ".`);
    }

    const status = metadataValue(text, "Status", relativePath);
    if (!status || !allowedStatuses.has(status)) {
        errors.push(`${relativePath}: Status must be one of ${[...allowedStatuses].join(", ")}.`);
    }
    const supersedes = referenceIds(metadataValue(text, "Supersedes", relativePath), "Supersedes", relativePath);
    const supersededBy = referenceIds(metadataValue(text, "Superseded by", relativePath), "Superseded by", relativePath);

    for (const section of requiredSections) {
        if (!text.includes(`## ${section}`)) {
            errors.push(`${relativePath}: missing required section "## ${section}".`);
        }
    }

    for (const prefix of ["FR", "NFR", "AC"]) {
        if (!matches(text, new RegExp(`\\b${prefix}-\\d{3}\\b`))) {
            errors.push(`${relativePath}: must contain at least one ${prefix} identifier.`);
        }
    }

    const headingIds = [...text.matchAll(/^### (AC-\d{3}):/gm)].map((match) => match[1]);
    if (new Set(headingIds).size !== headingIds.length) {
        errors.push(`${relativePath}: acceptance scenario IDs must be unique.`);
    }

    for (const prefix of ["FR", "NFR"]) {
        const definitionIds = [
            ...text.matchAll(new RegExp(`^- \\*\\*(${prefix}-\\d{3}):\\*\\*`, "gm")),
        ].map((match) => match[1]);
        if (new Set(definitionIds).size !== definitionIds.length) {
            errors.push(`${relativePath}: ${prefix} definition IDs must be unique.`);
        }
    }

    if (!isTemplate && status && status !== "Draft" && status !== "Superseded") {
        if (text.includes("[TODO:")) {
            errors.push(`${relativePath}: non-draft specifications cannot contain TODO placeholders.`);
        }
    }

    if (!isTemplate && status === "Verified") {
        if (/\|\s*Pending\s*\|/i.test(text) || /^- \[ \]/m.test(text)) {
            errors.push(`${relativePath}: verified specifications cannot contain pending evidence or unchecked items.`);
        }
    }

    const id = `SPEC-${expectedId}`;
    if (supersedes.includes(id) || supersededBy.includes(id)) {
        errors.push(`${relativePath}: a specification cannot supersede or be superseded by itself.`);
    }

    return {id, status, supersedes, supersededBy, relativePath, isTemplate};
}

if (!fs.existsSync(templatePath)) {
    errors.push("specs/_template/spec.md: template is missing.");
} else {
    validateDocument(templatePath, "0000", true);
}

for (const entry of fs.readdirSync(specsDirectory, {withFileTypes: true})) {
    if (!entry.isDirectory() || entry.name === "_template") {
        continue;
    }

    const directoryMatch = entry.name.match(/^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    if (!directoryMatch) {
        errors.push(`specs/${entry.name}: directory must use NNNN-lowercase-hyphenated-name.`);
        continue;
    }

    const specPath = path.join(specsDirectory, entry.name, "spec.md");
    if (!fs.existsSync(specPath)) {
        errors.push(`specs/${entry.name}: spec.md is missing.`);
        continue;
    }

    specifications.push(validateDocument(specPath, directoryMatch[1]));
}

const specificationsById = new Map();
for (const specification of specifications) {
    if (specificationsById.has(specification.id)) {
        errors.push(`${specification.relativePath}: duplicate specification ID ${specification.id}.`);
    } else {
        specificationsById.set(specification.id, specification);
    }
}

for (const specification of specifications) {
    if (specification.status === "Superseded" && specification.supersededBy.length === 0) {
        errors.push(`${specification.relativePath}: Superseded status requires at least one Superseded by reference.`);
    }
    if (specification.status !== "Superseded" && specification.supersededBy.length > 0) {
        errors.push(`${specification.relativePath}: only a Superseded specification may set Superseded by.`);
    }

    for (const targetId of specification.supersedes) {
        const target = specificationsById.get(targetId);
        if (!target) {
            errors.push(`${specification.relativePath}: Supersedes references missing ${targetId}.`);
            continue;
        }
        if (specification.status !== "Draft"
            && (target.status !== "Superseded" || !target.supersededBy.includes(specification.id))) {
            errors.push(`${specification.relativePath}: non-draft replacement ${specification.id} requires reciprocal `
                + `Superseded status and Superseded by metadata in ${targetId}.`);
        }
        if (specification.status === "Draft" && target.status === "Superseded"
            && !target.supersededBy.includes(specification.id)) {
            errors.push(`${specification.relativePath}: draft replacement cannot target already superseded ${targetId}.`);
        }
    }

    for (const replacementId of specification.supersededBy) {
        const replacement = specificationsById.get(replacementId);
        if (!replacement) {
            errors.push(`${specification.relativePath}: Superseded by references missing ${replacementId}.`);
            continue;
        }
        if (!replacementStatuses.has(replacement.status)) {
            errors.push(`${specification.relativePath}: replacement ${replacementId} must be Approved or later, `
                + "and cannot itself be Superseded.");
        }
        if (!replacement.supersedes.includes(specification.id)) {
            errors.push(`${specification.relativePath}: replacement ${replacementId} must reciprocally list `
                + `${specification.id} in Supersedes.`);
        }
    }
}

if (errors.length > 0) {
    console.error(`Spec validation failed with ${errors.length} error(s):`);
    for (const error of errors) {
        console.error(`- ${error}`);
    }
    process.exitCode = 1;
} else {
    console.log("Spec validation passed.");
}
