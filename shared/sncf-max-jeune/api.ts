import { jwtDecode } from "jwt-decode";

export interface GetTokenData {
  expiresIn: number;
  idToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface Travel {
  orderId: string;
  serviceItemId: string;
  dvNumber: string;
  origin: {
    label: string;
    rrCode: string;
  };
  destination: {
    label: string;
    rrCode: string;
  };
  departureDateTime: string;
  arrivalDateTime: string;
  travelClass: string;
  trainNumber: string;
  coachNumber: string;
  seatNumber: string;
  reservationDate: string;
  travelConfirmed: "TOO_EARLY_TO_CONFIRM" | "TOO_LATE_TO_CONFIRM" | "TO_BE_CONFIRMED" | "WILL_BE_CANCELED" | "CONFIRMED";
  travelStatus: "VALIDE" | string;
  avantage: boolean;
}

export default class SNCFMaxJeuneAPI {
  private static BASE_URL = "https://www.maxjeune-tgvinoui.sncf/api/public";

  private static DEFAULT_HEADERS = {
    "x-client-app": "MAX_JEUNE",
    "x-client-app-version": "2.5.13",
    "x-distribution-channel": "OUI",
    "Referer": "https://www.maxjeune-tgvinoui.sncf/sncf-connect/mes-voyages",
  }

  private token: string | null = null;

  constructor(private _refreshToken: string) {}

  public get refreshToken(): string {
    return this._refreshToken;
  }

  private set refreshToken(value: string) {
    this._refreshToken = value;
  }

  private mustRefreshToken(): boolean {
    let mustRefresh = false;
    if (this.token === null) {
      mustRefresh = true;
    }
    else {
      const payload = jwtDecode(this.token);
      if (payload.exp === undefined) {
        mustRefresh = true;
      } else {
        mustRefresh = payload.exp < Date.now() / 1000;
      }
    }

    return mustRefresh;
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    if (this.mustRefreshToken()) {
      const data = await this.getToken();
      this.token = data.idToken;
      this.refreshToken = data.refreshToken;
    }
  }

  async getTravels(cardNumber: string, startDate: Date): Promise<Travel[]> {
    await this.refreshTokenIfNeeded();
    const response = await fetch(`${SNCFMaxJeuneAPI.BASE_URL}/reservation/travel-consultation`, {
      method: "POST",
      headers: {
        ...SNCFMaxJeuneAPI.DEFAULT_HEADERS,
        "authorization": `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        cardNumber,
        startDate: startDate.toISOString(),
      }),
    });

    return await response.json() as Travel[];
  }

  async getToken(): Promise<GetTokenData> {
    const response = await fetch(`${SNCFMaxJeuneAPI.BASE_URL}/auth/sfc/token`, {
      method: "POST",
      headers: SNCFMaxJeuneAPI.DEFAULT_HEADERS,
      body: JSON.stringify({
        type: "REFRESH_TOKEN",
        refreshToken: this.refreshToken,
        redirectUri: "https://maxjeune-tgvinoui.sncf/auth/login/redirect",
      }),
    });

    return await response.json() as GetTokenData;
  }

  async confirmTravel(travel: Travel): Promise<void> {
    await this.refreshTokenIfNeeded();
    const response = await fetch(`${SNCFMaxJeuneAPI.BASE_URL}/reservation/travel-confirm`, {
      method: "POST",
      headers: {
        ...SNCFMaxJeuneAPI.DEFAULT_HEADERS,
        "authorization": `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        marketingCarrierRef: travel.dvNumber,
        trainNumber: travel.trainNumber,
        departureDateTime: travel.departureDateTime,
      }),
    });

    return await response.json() as void;
  }
}