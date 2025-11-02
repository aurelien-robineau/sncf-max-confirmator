import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getUsers, SNCFUser } from "./get-users";
import { confirmUsersTravels } from "./confirm-users-travels";

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
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: err.message ?? "An error occurred while retrieving SNCF users.",
      }),
    };
  }

  const confirmedTravelsCount = await confirmUsersTravels(users);

  const totalConfirmedTravelsCount = Object.values(confirmedTravelsCount).reduce((acc, count) => acc + count, 0);

  const stringifiedConfirmedTravelsCount = Object.entries(confirmedTravelsCount)
    .map(([cardNumber, count]) => `- ${cardNumber}: ${count}`)
    .join("\n");

  console.debug(
    totalConfirmedTravelsCount === 0
      ? "No travels confirmed."
      : `Travels confirmed: ${stringifiedConfirmedTravelsCount}`,
  );

  return {
    statusCode: 204,
    body: JSON.stringify({
      message:
        totalConfirmedTravelsCount === 0
          ? "No travels confirmed."
          : `Travels confirmed: ${stringifiedConfirmedTravelsCount}`,
    }),
  };
};
