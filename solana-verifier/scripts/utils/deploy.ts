import { promisify } from "util";
import process from "child_process";
import {
  verifiable,
  Programs,
} from "./utils";
import {
  address,
  Address,
} from "@solana/web3.js";
const exec = promisify(process.exec);

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

export async function codama_cli(): Promise<void> {
  // Run the node command to regenerate the Codama TS Client Code
  await exec("anchor run client");
}

interface DeploymentOutput {
  programId: string;
}

export async function deploy_cli(
  program: Programs,
  verify: boolean,
  upgradable: boolean,
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
