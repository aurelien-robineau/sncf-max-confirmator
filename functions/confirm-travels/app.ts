import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getParameterValue, updateParameter } from "../../shared/aws-ssm/helpers";
import SNCFMaxJeuneAPI, { Travel } from "../../shared/sncf-max-jeune/api";
import { SSMConfig } from "../../shared/aws-ssm/config";

interface SNCFUser {
  cardNumber: string;
  refreshToken: string;
}

async function getUsers(): Promise<SNCFUser[]> {
  const usersAsJSONString = await getParameterValue(SSMConfig.UsersParameterName, true);
  if (!usersAsJSONString) {
    throw new Error("Cannot get SNCF users from SSM.");
  }

  let users;
  try {
    users = JSON.parse(usersAsJSONString);
  }
  catch (err) {
    throw new Error("Cannot parse SNCF users from SSM.");
  }

  if (!Array.isArray(users)) {
    throw new Error("SNCF users is not an array.");
  }

  users = users.filter((user) => user.cardNumber && user.refreshToken);

  return users;
}

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

  const confirmedTravelsCount: { [key: string]: number } = {};
  for (const user of users) {
    const { cardNumber, refreshToken } = user;
    confirmedTravelsCount[cardNumber] = 0;

    const sncfApi = new SNCFMaxJeuneAPI(refreshToken);

    let travels: Travel[] = [];
    try {
      travels = await sncfApi.getTravels(cardNumber, new Date(Date.now() - (1000 * 60 * 60 * 24)));
    }
    catch (err) {
      console.error(`Error retrieving travels for card number ${user.cardNumber}.`);
      continue;
    }
  
    const travelsToConfirm = travels.filter((travel) => travel.travelConfirmed === "TO_BE_CONFIRMED");
    if (travelsToConfirm.length === 0) {
      user.refreshToken = sncfApi.refreshToken;
      continue;
    }
  
    for (const travel of travelsToConfirm) {
      try {
        await sncfApi.confirmTravel(travel);
        confirmedTravelsCount[cardNumber]++;
      }
      catch (err) {
        console.error(`Error confirming travel ${travel.orderId} for card number ${user.cardNumber}.`);
      }
    }

    user.refreshToken = sncfApi.refreshToken;
  }

  updateParameter(SSMConfig.UsersParameterName, JSON.stringify(users)).catch((err) => {
    console.error("Error updating SNCF users in SSM.", err);
  });

  const totalConfirmedTravelsCount = Object.values(confirmedTravelsCount).reduce((acc, count) => acc + count, 0);

  const stringifiedConfirmedTravelsCount = Object.entries(confirmedTravelsCount)
    .map(([cardNumber, count]) => `- ${cardNumber}: ${count}`)
    .join("\n");

  return {
    statusCode: 204,
    body: JSON.stringify({
      message: totalConfirmedTravelsCount === 0
        ? "No travels confirmed."
        : `Travels confirmed: ${stringifiedConfirmedTravelsCount}`,
    }),
  };
};
