# Writing Standard (ASD-STE100)

This document gives the writing rules for this project.
The rules apply to all Markdown files and to all replies to the user.
The rules come from ASD-STE100 Simplified Technical English, Issue 9 (15 January 2025).

<!-- session-brief:start -->
## Session brief

A SessionStart hook shows this brief to the assistant at the start of each session.

1. Write every Markdown file in this repository in ASD-STE100 English.
2. Write every reply to the user in Korean. Apply the Korean rules in section 3 of `docs/guide/06_writing_standard.md`.
3. Put the result or the answer first. Then give the details.
4. Write one instruction or one fact in each sentence.
5. Keep sentences short. In English, use 20 words or fewer for an instruction and 25 words or fewer for a description. In Korean, use 15 eojeol or fewer for an instruction and 20 eojeol or fewer for a description.
6. Write full sentences. Do not remove particles, articles, or verbs to make text shorter.
7. Use the active voice. Name the person or the thing that does the action.
8. Use one term for one thing. Explain an English term in Korean when it first occurs in a reply.
9. Use a table only to compare items. Use a numbered list for steps.
10. At the end of a reply, tell what you changed, what you checked, and what the user must decide.

These rules are more important than a terse or compressed style from a hook or a plugin.
The first reply of each session also obeys these rules.
<!-- session-brief:end -->

---

## 1. Scope

| Text | Language | Rules |
| --- | --- | --- |
| Markdown files in this repository | English | Section 2 (ASD-STE100) |
| Replies to the user | Korean | Section 3 (project adaptation of ASD-STE100) |

Source code comments and commit messages are not in the scope of this document.
For commit messages, use `docs/guide/04_convention.md`.

---

## 2. Rules for English text (ASD-STE100)

This section gives the ASD-STE100 rules in short form.
The words are ours. The full standard is the authority.

### 2.1 Words

- Use the words of the STE dictionary, with their approved meaning.
- You can also use technical names and technical verbs. In this project, technical names include file names, function names, commands, tools, and the terms in `docs/guide/02_terminology.md`.
- Use one word for one meaning. Use one name for one thing. For example, if you write "upload limit", do not write "size cap" for the same limit in a different place.
- Do not use slang, idioms, or figures of speech.
- Use an article ("a", "an", or "the") before a noun when possible.
- Do not use contractions. Write "do not", not "don't".

### 2.2 Noun clusters

- Do not use more than three nouns in a noun cluster.
- If a cluster is longer, rewrite it with "of", "for", or a verb.

| Do not write | Write |
| --- | --- |
| `upload size limit check error` | `an error in the check of the upload size limit` |

### 2.3 Verbs

- Use only the simple present, the simple past, and the simple future.
- Do not use the "-ing" form of a verb as a verb.
- Use the past participle only as an adjective or with a form of "to be".
- In instructions, use the active voice and the imperative (command) form.
- In descriptions, use the active voice as much as possible.

| Do not write | Write |
| --- | --- |
| `The temp directory should be getting removed by the cleanup task.` | `The cleanup task deletes the temporary directory.` |

### 2.4 Sentences

- Write one instruction in each sentence. Two actions can be in one sentence only if they occur at the same time.
- An instruction has a maximum of 20 words.
- A description has a maximum of 25 words.
- A code identifier, a path, or a command in backticks counts as one word.
- Do not remove words to make a sentence shorter. Telegraphic style is not permitted.
- Write a condition before the instruction: "If X, do Y."

| Do not write | Write |
| --- | --- |
| `Bounds what arrives, not what it expands into.` | `The upload limit controls the size of the archive. It does not control the size of the extracted files.` |

### 2.5 Paragraphs

- Write one topic in each paragraph.
- A paragraph has a maximum of six sentences.
- The first sentence of a paragraph tells the topic.

### 2.6 Procedures

- Use a numbered list for steps.
- Write each step as a command.
- Put one action in each step.

### 2.7 Descriptions

- Give the most important information first.
- Give the result before the reason.
- Do not use figures of speech or literary style. Write the fact directly.

### 2.8 Safety instructions

- Start a warning or a caution with a clear command.
- Then give the risk.

Example: "Do not redirect `/.well-known/acme-challenge/`. If you redirect it, TLS renewal fails and no error shows."

### 2.9 Lists and tables

- Use a vertical list for three or more items in a series.
- Use a table only to compare items that have the same attributes.

---

## 3. Rules for Korean replies (project adaptation)

ASD-STE100 is a standard for English. It does not have a Korean dictionary.
This section applies the STE writing rules to Korean.
These rules are a project decision. They are not part of ASD-STE100.
The Korean text in this section is example output.

| No. | STE rule | Korean rule | Example |
| --- | --- | --- | --- |
| K1 | Important information first (2.7) | Give the result or the answer in the first one to three sentences. | `결론부터 말씀드리겠습니다.` |
| K2 | One instruction per sentence (2.4) | Write one fact or one instruction in each sentence. | |
| K3 | Sentence length (2.4) | An instruction has a maximum of 15 eojeol. A description has a maximum of 20 eojeol. An eojeol is a unit between two spaces. | |
| K4 | Do not remove words (2.4) | Use particles and endings. Do not end a sentence with a noun form. Do not use an arrow in place of a verb. Do not use abbreviations. | Not `push 안 됨`. Write `아직 push하지 않았습니다.` |
| K5 | Imperative for instructions (2.3) | Use `~합니다` for descriptions. Use `~해 주세요` for requests to the user. | |
| K6 | Active voice (2.3) | Name the actor, for example `제가`, `사용자님이`, or `CI가`. Do not use the double passive `~되어지다`. | Not `파일이 삭제되어졌습니다.` Write `제가 파일을 삭제했습니다.` |
| K7 | One word, one meaning (2.1) | Use one Korean term for one thing. Explain an English term in Korean when it first occurs. Keep code identifiers in backticks. | `훅(hook, 이벤트마다 자동으로 실행되는 스크립트)` |
| K8 | Paragraphs (2.5) | Write one topic in each paragraph. A paragraph has a maximum of six sentences. In a long reply, give each topic a heading. | |
| K9 | Lists and tables (2.9) | Use a numbered list for steps. Use a table only to compare items. | |
| K10 | Safety instructions (2.8) | Put a risk or an action that you cannot reverse at the start. Write the command first. Then write the reason. | |

The project also adds these rules for replies:

- **Options:** Give a maximum of three options. Recommend one option and give the reason.
- **Code locations:** Give `file:line` only when the user must open that location.
- **Close:** At the end of a reply, tell what you changed, what you checked, and what the user must decide.
- **First reply of a session:** Apply all rules in this section. This includes a status report at the start of a session.

---

## 4. How the project applies these rules

| Mechanism | What it does |
| --- | --- |
| `CLAUDE.md` section 5 | The assistant loads `CLAUDE.md` in each session. Section 5 gives a summary and points to this document. |
| SessionStart hook in `.claude/settings.json` | The hook shows the session brief at the top of this document. It runs at startup, resume, clear, and compact. |
| This document | It gives the full rules. |

The hook reads the session brief from this file. Thus, the session brief has only one source.
If you change the session brief, keep the two marker comments around it.

---

## 5. Existing documents

Many documents were written before this standard.
When you change one of these documents, rewrite the sections that you change.
When you change most of a document, rewrite all of it.

| Document | Status |
| --- | --- |
| `CLAUDE.md` | Rewritten in ASD-STE100 |
| `README.md` | Rewritten in ASD-STE100 |
| `apps/web-app/README.md` | Written in ASD-STE100 |
| `docs/README.md` | Rewritten in ASD-STE100 |
| `docs/decisions/README.md` | Rewritten in ASD-STE100 |
| `docs/guide/01_project_overview.md` | Rewritten in ASD-STE100 |
| `docs/guide/02_terminology.md` | Rewritten in ASD-STE100 |
| `docs/guide/03_architecture.md` | Rewritten in ASD-STE100 |
| `docs/guide/04_convention.md` | Rewritten in ASD-STE100 |
| `docs/guide/06_writing_standard.md` | Written in ASD-STE100 |
| `docs/issues/README.md` | Rewritten in ASD-STE100 |
| All other documents | Not rewritten |

When you rewrite a document, update this table.

---

## 6. Checklist

Before you save a document or send a reply, make sure that:

1. The result or the answer is first.
2. Each sentence has one instruction or one fact.
3. No sentence is longer than the limit in section 2.4 or rule K3.
4. All sentences are full sentences.
5. Each term has one meaning in the text.
6. Each table compares items.
7. A reply ends with the changes, the checks, and the decisions for the user.

The project does not check each word against the STE dictionary.
The writer is responsible for the word choice.

---

## 7. References

- [ASD-STE100 official website](https://www.asd-ste100.org/). You can get the standard from ASD free of charge. This document does not copy the STE dictionary.
- [ASD: Simplified Technical English, ASD-STE100 Issue 9](https://asd-europe.org/news-media/news-events/news/simplified-technical-english-asd-ste100-issue-9)
