#!/usr/bin/env node

import { main } from "./run";

process.exitCode = main(process.argv.slice(2));
