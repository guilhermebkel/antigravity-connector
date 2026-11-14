# Docs standards

What goes in `docs/` and where everything else goes.

## Two kinds of file

- **Standard.** A rule that applies to every file of its kind. Each rule is one line a reviewer or a tool can answer yes or no, tagged with how it is checked. The file is `docs/<topic>-standards.md`. Harness changes follow `docs/harness-standards.md`.
- **Guide.** How to do a recurring job. A guide is listed in the table below. There is none yet.

`docs/adr/` and `docs/agents/` keep their own rules and are not classified here.

## What a standard never contains

- A class, constant or message as the rule. An example may name one, as an example: inside a fenced block, or on a line that says "e.g." or "for example".
- A description of the product. The product and its terms are in `GLOSSARY.md`.

Test for a new line: **would it stay true if the class or message it mentions were renamed or deleted?** If not, it does not go in a standard.

## Where the other content goes

- What the product does, and its terms: `GLOSSARY.md` and the project brief (issue #1).
- Why a choice was made: `docs/adr/`.
- A rule a tool can check is a tool (`docs/code-standards.md`); the standard then says which tool and keeps the line.
- A path named in a doc, a config or a script must exist; `scripts/doc-paths.test.mjs` checks it. A path created by a later issue is listed in that test as planned, with the issue number.
