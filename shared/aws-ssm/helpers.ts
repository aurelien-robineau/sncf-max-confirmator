import ssm from ".";

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