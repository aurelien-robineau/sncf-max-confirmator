import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getParameterValue, updateParameter } from "../../shared/aws-ssm/helpers";
import SNCFMaxJeuneAPI, { Travel } from "../../shared/sncf-max-jeune/api";
import { SSMConfig } from "../../shared/aws-ssm/config";

/**
 * Represents a SNCF user.
 * Note: cardNumber is no longer stored here as it's retrieved from the API.
 */
interface SNCFUser {
  /**
   * The name of the SNCF user (optional, for identification of the token).
   */
  name?: string;
  
  /**
   * The access token (opaque auth token) of the SNCF user.
   */
  accessToken: string;
}

/**
 * Retrieves the SNCF users from SSM.
 * @returns The SNCF users from SSM.
 */
async function getUsers(): Promise<SNCFUser[]> {
  console.debug("Getting SNCF users from SSM...")

  const usersAsJSONString = await getParameterValue(SSMConfig.UsersParameterName, true);
  if (!usersAsJSONString) {
    console.error("Cannot get SNCF users from SSM.");
    throw new Error("Cannot get SNCF users from SSM.");
  }

  let users;
  try {
    users = JSON.parse(usersAsJSONString);
  }
  catch (err) {
    console.error("Cannot parse SNCF users from SSM.");
    throw new Error("Cannot parse SNCF users from SSM.");
  }

  if (!Array.isArray(users)) {
    console.error("SNCF users is not an array.");
    throw new Error("SNCF users is not an array.");
  }

  users = users.filter((user) => user.accessToken);

  console.debug(`Found ${users.length} users with access token.`)

  return users;
}

/**
 * Confirms the travels for the SNCF users.
 * @param users - The SNCF users to confirm travels for.
 * @returns The number of confirmed travels for each card number.
 */
export  async function confirmUserTravels(users: SNCFUser[]): Promise<{ [key: string]: number; }> {
  console.debug(`Confirming travels for ${users.length} users...`)

  const oneDayAgo = new Date(Date.now() - (1000 * 60 * 60 * 24));
  const confirmedTravelsCount: { [key: string]: number } = {};
  
  for (const user of users) {
    console.debug(`Confirming travels for user: ${user.name}`)

    const { accessToken } = user;
    const sncfApi = new SNCFMaxJeuneAPI(accessToken);

    let customerInfo;
    try {
      console.debug(`Retrieving customer info for user: ${user.name}`)

      customerInfo = await sncfApi.getCustomerInfo();
      user.accessToken = sncfApi.accessToken;
      user.name = `${customerInfo.firstName} ${customerInfo.lastName}`;
    }
    catch (err: any) {
      console.error(`Error retrieving customer info for user ${user.name}: ${err.message}`);
      continue;
    }

    const validCards = customerInfo.cards.filter(
      (card) => card.contractStatus === "VALIDE" && card.productType === "TGV_MAX_JEUNE"
    );

    if (validCards.length === 0) {
      console.log(`No valid TGV_MAX_JEUNE cards found for user`);
      continue;
    }

    for (const card of validCards) {
      console.debug(`Processing card: ${card.cardNumber}`)

      const cardNumber = card.cardNumber;
      if (!confirmedTravelsCount[cardNumber]) {
        confirmedTravelsCount[cardNumber] = 0;
      }

      let travels: Travel[] = [];
      try {
        console.debug(`Retrieving travels for card number: ${card.cardNumber}`)
        travels = await sncfApi.getTravels(cardNumber, oneDayAgo);
        user.accessToken = sncfApi.accessToken;
      }
      catch (err: any) {
        console.error(`Error retrieving travels for card number ${cardNumber}: ${err.message}`);
        continue;
      }

      console.debug(`Found ${travels.length} travels for card number: ${cardNumber}`)
    
      const travelsToConfirm = travels.filter((travel) => travel.travelConfirmed === "TO_BE_CONFIRMED");
      console.debug(`Found ${travelsToConfirm.length} travels to confirm for card number: ${cardNumber}`)

      if (travelsToConfirm.length === 0) {
        console.debug(`No travels to confirm for card number: ${cardNumber}`)
        continue;
      }
    
      for (const travel of travelsToConfirm) {
        console.debug(`Confirming travel: ${travel.orderId} for card number: ${cardNumber}`)

        try {
          await sncfApi.confirmTravel(travel);
          user.accessToken = sncfApi.accessToken;
          confirmedTravelsCount[cardNumber]++;
        }
        catch (err: any) {
          console.error(`Error confirming travel ${travel.orderId} for card number ${cardNumber}: ${err.message}`);
        }
      }
    }
  }

  console.debug(`Updating SNCF users in SSM...`)

  updateParameter(SSMConfig.UsersParameterName, JSON.stringify(users)).catch((err) => {
    console.error("Error updating SNCF users in SSM.", err);
  });

  return confirmedTravelsCount;
}

/**
 * Confirms the travels for the SNCF users.
 * 
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} _event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
export const lambdaHandler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  let users: SNCFUser[];
  try {
    users = await getUsers();
  }
  catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: err.message ?? "An error occurred while retrieving SNCF users.",
      }),
    };
  }

  const confirmedTravelsCount = await confirmUserTravels(users);

  const totalConfirmedTravelsCount = Object.values(confirmedTravelsCount).reduce((acc, count) => acc + count, 0);

  const stringifiedConfirmedTravelsCount = Object.entries(confirmedTravelsCount)
    .map(([cardNumber, count]) => `- ${cardNumber}: ${count}`)
    .join("\n");

  console.debug(
    totalConfirmedTravelsCount === 0
    ? "No travels confirmed."
    : `Travels confirmed: ${stringifiedConfirmedTravelsCount}`
  );

  return {
    statusCode: 204,
    body: JSON.stringify({
      message: totalConfirmedTravelsCount === 0
        ? "No travels confirmed."
        : `Travels confirmed: ${stringifiedConfirmedTravelsCount}`,
    }),
  };
};
