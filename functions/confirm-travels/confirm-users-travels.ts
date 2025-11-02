import { SSMConfig } from "../../shared/aws-ssm/config";
import { updateParameter } from "../../shared/aws-ssm/helpers";
import SNCFMaxJeuneAPI, { Travel } from "../../shared/sncf-max-jeune/api";
import { SNCFUser } from "./get-users";

/**
 * Confirms the travels for the SNCF users.
 * @param users - The SNCF users to confirm travels for.
 * @returns The number of confirmed travels for each card number.
 */
export async function confirmUsersTravels(users: SNCFUser[]): Promise<{ [key: string]: number }> {
  const oneDayAgo = new Date(Date.now() - 1000 * 60 * 60 * 24);
  const confirmedTravelsCount: { [key: string]: number } = {};

  for (const user of users) {
    const { accessToken } = user;
    const sncfApi = new SNCFMaxJeuneAPI(accessToken);

    let customerInfo;
    try {
      console.debug(`Retrieving customer info for user ${user.name}...`);

      customerInfo = await sncfApi.getCustomerInfo();
      user.accessToken = sncfApi.accessToken;
      user.name = `${customerInfo.firstName} ${customerInfo.lastName}`;
    } catch (err: any) {
      console.error(`Error retrieving customer info for user ${user.name}: ${err.message}`);
      continue;
    }

    const validCards = customerInfo.cards.filter(
      (card) => card.contractStatus === "VALIDE" && card.productType === "TGV_MAX_JEUNE",
    );

    if (validCards.length === 0) {
      console.debug(`No valid TGV_MAX_JEUNE cards found for user ${user.name}.`);
      continue;
    } else {
      console.debug(`Found ${validCards.length} valid TGV_MAX_JEUNE cards for user ${user.name}:`);
      validCards.forEach((card) => console.debug(`- ${card.cardNumber}`));
    }

    for (const card of validCards) {
      const cardNumber = card.cardNumber;
      if (!confirmedTravelsCount[cardNumber]) {
        confirmedTravelsCount[cardNumber] = 0;
      }

      let travels: Travel[] = [];
      try {
        console.debug(`Retrieving travels for card number ${card.cardNumber}...`);
        travels = await sncfApi.getTravels(cardNumber, oneDayAgo);
        user.accessToken = sncfApi.accessToken;
      } catch (err: any) {
        console.error(`Error retrieving travels for card number ${cardNumber}: ${err.message}`);
        continue;
      }

      console.debug(`Found ${travels.length} travels for card number ${cardNumber}.`);

      const travelsToConfirm = travels.filter((travel) => travel.travelConfirmed === "TO_BE_CONFIRMED");
      console.debug(`Found ${travelsToConfirm.length} travels to confirm for card number ${cardNumber}.`);

      if (travelsToConfirm.length === 0) {
        console.debug(`No travels to confirm for card number ${cardNumber}.`);
        continue;
      }

      for (const travel of travelsToConfirm) {
        console.debug(`Confirming travel ${travel.orderId} for card number ${cardNumber}...`);

        try {
          await sncfApi.confirmTravel(travel);
          user.accessToken = sncfApi.accessToken;
          confirmedTravelsCount[cardNumber]++;
        } catch (err: any) {
          console.error(`Error confirming travel ${travel.orderId} for card number ${cardNumber}: ${err.message}`);
        }
      }
    }
  }

  console.debug(`Updating SNCF users in SSM...`);

  updateParameter(SSMConfig.UsersParameterName, JSON.stringify(users)).catch((err) => {
    console.error("Error updating SNCF users in SSM.", err);
  });

  return confirmedTravelsCount;
}
