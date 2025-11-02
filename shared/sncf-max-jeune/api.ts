/**
 * Represents a travel/booking in the SNCF Max Jeune system.
 */
export interface Travel {
    /** The order ID for this travel. */
    orderId: string;
    /** The DV number (marketing carrier reference) for this travel. */
    dvNumber: string;
    /** The departure date and time in ISO 8601 format. */
    departureDateTime: string;
    /** The train number. */
    trainNumber: string;
    /** The confirmation status of the travel. */
    travelConfirmed:
        | "TOO_EARLY_TO_CONFIRM"
        | "TOO_LATE_TO_CONFIRM"
        | "TO_BE_CONFIRMED"
        | "WILL_BE_CANCELED"
        | "CONFIRMED";
}

/**
 * Represents a SNCF Max Jeune card.
 */
export interface Card {
    /** The card number. */
    cardNumber: string;
    /** The product type (e.g., "TGV_MAX_JEUNE"). */
    productType: string;
    /** The contract status (e.g., "VALIDE"). */
    contractStatus: string;
}

/**
 * Represents customer information from the SNCF Max Jeune API.
 */
export interface CustomerInfo {
    /** The customer's first name. */
    firstName: string;
    /** The customer's last name. */
    lastName: string;
    /** Array of cards associated with this customer. */
    cards: Card[];
}

/**
 * Client for interacting with the SNCF Max Jeune API.
 * Handles authentication token refresh automatically.
 */
export default class SNCFMaxJeuneAPI {
    private static BASE_URL = "https://www.maxjeune-tgvinoui.sncf/api/public";

    private static DEFAULT_HEADERS = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Client-App": "MAX_JEUNE",
        "X-Client-App-Version": "2.42.1",
        "X-Distribution-Channel": "OUI",
        Referer: "https://www.maxjeune-tgvinoui.sncf/sncf-connect/mes-voyages",
    };

    private _accessToken: string;

    /**
     * Creates a new SNCFMaxJeuneAPI instance.
     * @param accessToken - The initial access token (auth cookie) for authentication.
     */
    constructor(accessToken: string) {
        this._accessToken = accessToken;
    }

    /**
     * Gets the current access token.
     * The token is automatically updated when API responses include new auth cookies.
     * @returns The current access token.
     */
    public get accessToken(): string {
        return this._accessToken;
    }

    /**
     * Extracts the auth cookie from the Set-Cookie header of an API response.
     * @param response - The fetch Response object.
     * @returns The auth cookie value, or null if not found.
     */
    private extractAuthCookieFromHeaders(response: Response): string | null {
        const setCookieHeader = response.headers.get("Set-Cookie");
        if (!setCookieHeader) {
            return null;
        }

        const match = setCookieHeader.match(/auth=([^;]+)/);
        return match ? match[1].trim() : null;
    }

    /**
     * Makes an authenticated request to the SNCF Max Jeune API.
     * Automatically handles token refresh if a new auth cookie is returned.
     * @param url - The API endpoint URL.
     * @param options - Additional fetch options.
     * @returns The Response object.
     * @throws Error if the API request fails.
     */
    private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...SNCFMaxJeuneAPI.DEFAULT_HEADERS,
                Cookie: `auth=${this._accessToken}`,
                ...options.headers,
            },
        });

        const newAuthCookie = this.extractAuthCookieFromHeaders(response);
        if (newAuthCookie && newAuthCookie !== this._accessToken) {
            this._accessToken = newAuthCookie;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed (${response.status}): ${errorText}`);
        }

        return response;
    }

    /**
     * Retrieves travels for a specific card number starting from a given date.
     * @param cardNumber - The SNCF Max Jeune card number.
     * @param startDate - The start date to retrieve travels from.
     * @returns Array of travels for the card.
     * @throws Error if the API request fails or response format is invalid.
     */
    async getTravels(cardNumber: string, startDate: Date): Promise<Travel[]> {
        const response = await this.makeRequest(`${SNCFMaxJeuneAPI.BASE_URL}/reservation/travel-consultation`, {
            method: "POST",
            body: JSON.stringify({
                cardNumber,
                startDate: startDate.toISOString(),
            }),
        });

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Cannot get travels from SNCF Max Jeune.");
        }

        return data as Travel[];
    }

    /**
     * Retrieves customer information including card numbers.
     * @returns Customer information with cards array
     */
    async getCustomerInfo(): Promise<CustomerInfo> {
        const response = await this.makeRequest(`${SNCFMaxJeuneAPI.BASE_URL}/customer/read-customer`, {
            method: "POST",
            body: JSON.stringify({
                productTypes: ["TGV_MAX_JEUNE"],
            }),
        });

        const data = await response.json();
        return data as CustomerInfo;
    }

    /**
     * Confirms a travel booking.
     * @param travel - The travel object to confirm.
     * @returns Promise that resolves when the travel is confirmed.
     * @throws Error if the API request fails.
     */
    async confirmTravel(travel: Travel): Promise<void> {
        const response = await this.makeRequest(`${SNCFMaxJeuneAPI.BASE_URL}/reservation/travel-confirm`, {
            method: "POST",
            body: JSON.stringify({
                marketingCarrierRef: travel.dvNumber,
                trainNumber: travel.trainNumber,
                departureDateTime: travel.departureDateTime,
            }),
        });

        return (await response.json()) as void;
    }
}
