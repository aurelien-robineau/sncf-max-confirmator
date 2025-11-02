import { SSMConfig } from "../../shared/aws-ssm/config";
import { getParameterValue } from "../../shared/aws-ssm/helpers";

/**
 * Represents a SNCF user.
 * Note: cardNumber is no longer stored here as it's retrieved from the API.
 */
export interface SNCFUser {
  /**
   * The name of the SNCF user (optional, for identification of the token).
   */
  name?: string;

  /**
   * The access token (opaque auth token) of the SNCF user.
   */
  accessToken: string;

  /**
   * The DataDome cookie (optional, helps bypass bot protection).
   */
  datadomeCookie?: string;
}

/**
 * Retrieves the SNCF users from SSM.
 * @returns The SNCF users from SSM.
 */
export async function getUsers(): Promise<SNCFUser[]> {
  console.debug("Getting SNCF users from SSM...");

  const usersAsJSONString = await getParameterValue(SSMConfig.UsersParameterName, true);
  if (!usersAsJSONString) {
    console.error("Cannot get SNCF users from SSM.");
    throw new Error("Cannot get SNCF users from SSM.");
  }

  let users;
  try {
    users = JSON.parse(usersAsJSONString);
  } catch (err) {
    console.error("Cannot parse SNCF users from SSM.");
    throw new Error("Cannot parse SNCF users from SSM.");
  }

  if (!Array.isArray(users)) {
    console.error("SNCF users is not an array.");
    throw new Error("SNCF users is not an array.");
  }

  users = users.filter((user) => user.accessToken);

  console.debug(`Found ${users.length} valid users.`);

  return users;
}
