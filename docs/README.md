# StringLights Documentation

Each document has one location only.
Select the directory by the **type** of the document, not by its subject.

| Directory | Contents | Lifecycle |
| --- | --- | --- |
| [`guide/`](./guide/) | Approved rules: overview, terminology, architecture, conventions, deployment, and writing standard | Stable. It changes only when a new decision replaces a rule. |
| [`decisions/`](./decisions/) | ADRs. Each ADR gives a decision and the trade-off that it accepts. | You write an ADR once, at the time of the decision. Then you do not change it. |
| [`issues/`](./issues/) | Open problems, one file for each problem | You update the `Status` field in the file. |
| [`history/`](./history/) | Post-mortems of problems that are **resolved** | You add new files only. You do not edit a file. |
| [`design/`](./design/) | UI/UX direction, references, and mockups | You update a document when the design changes. |

## What a `guide/` document contains

**A `guide/` document tells what is true now. It must not tell what you plan to do.**

Put work that is not complete in `issues/`.
Put a choice that people do not agree on in `decisions/`.
Put a goal for the future in `design/`.
If a `guide/` document and the code do not agree, the code is correct. The document has the error.

## Language and writing standard

Write all `.md` files in this repository in **English**. This includes working notes and issue reports.
English keeps the repository open to contributors from outside the project.
English also decreases the context cost of the documents that agents load in each session.

Write all `.md` files with the **ASD-STE100** Simplified Technical English rules.
See [`guide/06_writing_standard.md`](./guide/06_writing_standard.md) for the rules.
Many documents were written before this rule. When you change one of these documents, rewrite the sections that you change.

Speak in the language that is comfortable for you. Write commits in English.

## Naming

| Directory | Pattern | Example |
| --- | --- | --- |
| `guide/` | `NN_snake_case.md` | `03_architecture.md` |
| `decisions/` | `NNNN-kebab-case.md` | `0001-promote-all-intermediate-outputs.md` |
| `issues/` | `NNN-kebab-case.md` | `001-model-load-hang.md` |
| `history/` | `YYYY-MM-DD-<type>-<slug>.md` | `2026-06-13-error-vite-wasm-import.md` |
| `design/` | Free form | `direction.md` |

The paths of issue files and ADR files do not change.
When you close an issue, change its `Status` field. Do not move or rename the file.
Then the links from commits and ADRs continue to work.

## Related documents

- [`../CLAUDE.md`](../CLAUDE.md): session rules and the documents to read before a change
- [`guide/04_convention.md`](./guide/04_convention.md): coding and Git conventions
- [`guide/06_writing_standard.md`](./guide/06_writing_standard.md): writing rules (ASD-STE100)
