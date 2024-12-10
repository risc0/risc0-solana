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
const loaderV4IdlPath = path.normalize("../idl/loader-v4.json");

const routerIdl = require(routerIdlPath);
const grothIdl = require(grothIdlPath);
const badVerifierIdl = require(badVerifierIdlPath);
const loaderV3Idl = require(loaderV3IdlPath);
const loaderV4Idl = require(loaderV4IdlPath);

const routerCodama = createFromRoot(rootNodeFromAnchor(routerIdl));
const grothCodama = createFromRoot(rootNodeFromAnchor(grothIdl));
const badVerifierCodama = createFromRoot(rootNodeFromAnchor(badVerifierIdl));
const loaderV3Codama = createFromRoot(rootNodeFromAnchor(loaderV3Idl));
const loaderV4Codama = createFromRoot(rootNodeFromAnchor(loaderV4Idl));

routerCodama.accept(renderJavaScriptVisitor("./scripts/verify-router"));
grothCodama.accept(renderJavaScriptVisitor("./scripts/groth16"));
badVerifierCodama.accept(renderJavaScriptVisitor("./scripts/bad-verifier"));
loaderV3Codama.accept(renderJavaScriptVisitor("./scripts/loaderV3"));
loaderV4Codama.accept(renderJavaScriptVisitor("./scripts/loaderV4"));
