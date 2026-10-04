import fs from "node:fs";
import {
  readSession,
  evaluate,
  diagnosticCommand,
} from "./dashell-host-session.mjs";
const [descriptor, mode, input] = process.argv.slice(2);
const session = readSession(descriptor);
const result =
  mode === "script"
    ? evaluate(session, fs.readFileSync(input, "utf8"))
    : mode === "eval"
      ? evaluate(session, input)
      : diagnosticCommand(session, mode, input ? [`path=${input}`] : []);
console.log(JSON.stringify(result, null, 2));
