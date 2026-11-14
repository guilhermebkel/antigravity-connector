#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const NO_SESSION_FIXTURE = join(import.meta.dirname, "fixtures", "noSession.txt");
const EXIT_CODE_NO_SESSION = 1;

process.stdout.write(readFileSync(NO_SESSION_FIXTURE, "utf8"));
process.exitCode = EXIT_CODE_NO_SESSION;
