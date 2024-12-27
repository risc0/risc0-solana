/**
 * Generates TypeScript client code from Anchor IDL files for the Risc0 Router and related programs.
 * This script uses Codama to create strongly-typed TypeScript interfaces and functions for interacting with the Solana programs.
 *
 * ## Overview
 *
 * The script processes four IDL files:
 * 1. Verifier Router IDL
 * 2. Groth16 Verifier IDL
 * 3. Test Bad Verifier IDL
 * 4. Loader V3 IDL
 *
 * For each IDL, it generates corresponding TypeScript code in the following directories:
 * - `./scripts/verify-router/`
 * - `./scripts/groth16/`
 * - `./scripts/bad-verifier/`
 * - `./scripts/loaderV3/`
 *
 * ## Requirements
 *
 * The script expects the following IDL files to exist:
 * - `../target/idl/verifier_router.json`
 * - `../target/idl/groth_16_verifier.json`
 * - `../target/idl/test_bad_verifier.json`
 * - `../idl/loader-v3.json`
 *
 * ## Usage
 *
 * This script is typically run as part of the build process and is called by other scripts (like deploy.ts).
 * However, it can be run manually to regenerate the TypeScript client code:
 *
 * ```bash
 * yarn run client
 * ```
 *
 * ## Note
 *
 * - This script should be run after any changes to the Anchor programs to ensure the TypeScript client code stays in sync
 * - The script will fail if any of the required IDL files are missing
 * - Generated code should not be manually modified as it will be overwritten on the next run
 */
import { createFromRoot } from "codama";
import { renderJavaScriptVisitor } from "@codama/renderers";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import path from "node:path";

// Create Codama instances dynamically
const routerIdlPath = path.normalize("../target/idl/verifier_router.json");
const grothIdlPath = path.normalize("../target/idl/groth_16_verifier.json");
const badVerifierIdlPath = path.normalize(
  "../target/idl/test_bad_verifier.json"
);
const loaderV3IdlPath = path.normalize("../idl/loader-v3.json");

const routerIdl = require(routerIdlPath);
const grothIdl = require(grothIdlPath);
const badVerifierIdl = require(badVerifierIdlPath);
const loaderV3Idl = require(loaderV3IdlPath);

const routerCodama = createFromRoot(rootNodeFromAnchor(routerIdl));
const grothCodama = createFromRoot(rootNodeFromAnchor(grothIdl));
const badVerifierCodama = createFromRoot(rootNodeFromAnchor(badVerifierIdl));
const loaderV3Codama = createFromRoot(rootNodeFromAnchor(loaderV3Idl));

routerCodama.accept(renderJavaScriptVisitor("./scripts/verify-router"));
grothCodama.accept(renderJavaScriptVisitor("./scripts/groth16"));
badVerifierCodama.accept(renderJavaScriptVisitor("./scripts/bad-verifier"));
loaderV3Codama.accept(renderJavaScriptVisitor("./scripts/loaderV3"));
