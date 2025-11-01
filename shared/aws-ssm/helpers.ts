import ssm from ".";

/**
 * Retrieves a parameter value from AWS Systems Manager Parameter Store.
 * @param name - The name/path of the parameter.
 * @param withDecryption - Whether to decrypt the parameter value (for SecureString types).
 * @returns The parameter value, or null if not found or an error occurs.
 */
export async function getParameterValue(name: string, withDecryption: boolean): Promise<string | null> {
  try {
    const data = await ssm.getParameter({
      Name: name,
      WithDecryption: withDecryption,
    }).promise();

    return data?.Parameter?.Value ?? null;
  }
  catch (err) {
    console.error(`Error retrieving parameter ${name} from AWS SSM.`, err);
    return null;
  }
}

/**
 * Updates or creates a parameter in AWS Systems Manager Parameter Store.
 * The parameter is stored as a SecureString type and will overwrite any existing parameter with the same name.
 * @param name - The name/path of the parameter.
 * @param value - The value to store in the parameter.
 * @returns Promise that resolves when the parameter is updated.
 */
export async function updateParameter(name: string, value: string): Promise<void> {
  try {
    await ssm.putParameter({
      Name: name,
      Value: value,
      Type: "SecureString",
      Overwrite: true,
    }).promise();
  }
  catch (err) {
    console.error(`Error updating parameter ${name} in AWS SSM.`, err);
  }
}