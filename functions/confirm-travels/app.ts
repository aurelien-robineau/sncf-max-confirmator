import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getSNCFCardNumber, getSNCFRefreshToken, updateSNCFRefreshToken } from "../../shared/aws-ssm/helpers";
import SNCFMaxJeuneAPI, { Travel } from "../../shared/sncf-max-jeune/api";

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

  let travels: Travel[];
  try {
    travels = await sncfApi.getTravels(cardNumber, new Date(Date.now() - (1000 * 60 * 60 * 24)));

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
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "An error occurred while confirming travels.",
      }),
    };
  }

  if (sncfApi.refreshToken !== refreshToken) {
    updateSNCFRefreshToken(sncfApi.refreshToken).catch((err) => {
      console.error("Error updating SNCF Refresh Token in SSM.", err);
    });
  }

  return {
    statusCode: 204,
    body: JSON.stringify({
      message: `Successfully confirmed ${travels.length} travel(s).`,
    }),
  };
};
