import ssm from ".";
import { SSMConfig } from "./config";

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

export async function getSNCFRefreshToken(): Promise<string> {
  const refreshToken = await getParameterValue(SSMConfig.RefreshTokenParameterName, true);
  if (!refreshToken) {
    throw new Error("SNCF Refresh token not found in AWS SSM.");
  }

  return refreshToken;
}

export async function getSNCFCardNumber(): Promise<string> {
  const cardNumber = await getParameterValue(SSMConfig.CardNumberParameterName, true);
  if (!cardNumber) {
    throw new Error("SNCF Card number not found in AWS SSM.");
  }

  return cardNumber;
}