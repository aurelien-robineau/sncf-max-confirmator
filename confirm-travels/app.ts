import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getSNCFCardNumber, getSNCFRefreshToken } from "../aws-ssm/helpers";
import SNCFMaxJeuneAPI from "../sncf-max-jeune/api";

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
  let refreshToken: string, cardNumber: string;
  try {
    refreshToken = await getSNCFRefreshToken();
    cardNumber = await getSNCFCardNumber();
  }
  catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Cannot get SNCF Refresh Token and/or Card Number from SSM.",
      }),
    };
  }

  const sncfApi = new SNCFMaxJeuneAPI(refreshToken);
  try {
    const travels = await sncfApi.getTravels(cardNumber, new Date(Date.now() - (1000 * 60 * 60 * 24)));

    const travelsToConfirm = travels.filter((travel) => travel.travelConfirmed === "TO_BE_CONFIRMED");
    if (travelsToConfirm.length === 0) {
      return {
        statusCode: 204,
        body: JSON.stringify({
          message: `No travels to confirm.`,
        }),
      };
    }

    for (const travel of travelsToConfirm) {
      await sncfApi.confirmTravel(travel);
    }

    return {
      statusCode: 204,
      body: JSON.stringify({
        message: `Successfully confirmed ${travels.length} travel(s).`,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "An error occurred while confirming travels.",
      }),
    };
  }
};
