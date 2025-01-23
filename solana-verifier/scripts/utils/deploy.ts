import { promisify } from "util";
import process from "child_process";
import { verifiable, Programs } from "./utils";
import { address, Address } from "@solana/web3.js";
const exec = promisify(process.exec);

/**
 * Builds the Anchor project using the Anchor CLI
 *
 * Synchronizes program keys and builds the project with optional verifiable output.
 * First runs 'anchor keys sync' to ensure program IDs match, then executes
 * 'anchor build' with the --verifiable flag if specified in environment.
 *
 * @returns {Promise<void>} Resolves when build is complete
 * @throws If any anchor command fails during execution
 */
export async function build_cli(): Promise<void> {
  // Sync Keys before building
  await exec("anchor keys sync");
  // Build with verifiable outputs
  const verify = verifiable();
  if (verify) {
    await exec("anchor build --verifiable");
  } else {
    await exec("anchor build");
  }
}

/**
 * Regenerates TypeScript client code using Codama
 *
 * Executes the configured client script in Anchor.toml which uses Codama to
 * generate TypeScript bindings from the program's IDL definitions. This keeps
 * the client code in sync with any program changes.
 *
 * @returns {Promise<void>} Resolves when code generation is complete
 * @throws If the codama generation script fails
 */
export async function codama_cli(): Promise<void> {
  // Run the node command to regenerate the Codama TS Client Code
  await exec("anchor run client");
}

interface DeploymentOutput {
  programId: string;
}

/**
 * Deploys a Solana program using the Anchor CLI
 *
 * Deploys a specified program with configurable verification and upgradeability options.
 * Uses 'anchor deploy' with JSON output format and optional flags for verification
 * and program finalization.
 *
 * @param {Programs} program - The program to deploy (from Programs enum)
 * @param {boolean} verify - Whether to verify the deployed program on-chain
 * @param {boolean} upgradable - Whether to deploy as an upgradeable program
 * @returns {Promise<Address<string>>} The address of the deployed program
 * @throws If deployment fails or if JSON output cannot be parsed
 *
 * @example
 * const address = await deploy_cli(Programs.VerifierRouter, true, true);
 */
export async function deploy_cli(
  program: Programs,
  verify: boolean,
  upgradable: boolean
): Promise<Address<string>> {
  const command = [`anchor deploy --program-name ${program}`];

  if (verify) {
    command.push("--verify");
  }

  if (upgradable) {
    command.push("");
  }

  command.push("-- --output json");

  if (!upgradable) {
    command.push("--final");
  }
  const rawOutput = (await exec(command.join(" "))).stdout;

  // Sometimes Anchor output prints things before and after the json data
  // We want to extract the data in braces {}
  const extractJsonObject = (input: string): DeploymentOutput => {
    const match = input.match(/{[^]*}/);
    if (!match) {
      throw new Error("No JSON object found in output");
    }
    return JSON.parse(match[0]) as DeploymentOutput;
  };

  const output = extractJsonObject(rawOutput);

  return address(output.programId);
}
