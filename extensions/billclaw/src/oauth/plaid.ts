/**
 * Plaid OAuth handler - implements Plaid Link flow
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { BillclawConfig } from "../../config.js";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import type {
  LinkTokenCreateRequest,
  LinkTokenCreateResponse,
  ItemPublicTokenExchangeRequest,
  ItemPublicTokenExchangeResponse,
} from "plaid";

export interface PlaidOAuthResult {
  success: boolean;
  itemId?: string;
  accessToken?: string;
  error?: string;
}

export interface CreateLinkTokenResult {
  success: boolean;
  linkToken?: string;
  error?: string;
}

/**
 * Get Plaid configuration from OpenClaw config
 */
function getPlaidConfig(context: OpenClawPluginApi): {
  clientId: string;
  secret: string;
  environment: string;
} {
  const config = context.pluginConfig as BillclawConfig;
  const plaidConfig = config?.plaid || {};

  const clientId = plaidConfig.clientId || process.env.PLAID_CLIENT_ID;
  const secret = plaidConfig.secret || process.env.PLAID_SECRET;
  const environment = plaidConfig.environment || "sandbox";

  if (!clientId || !secret) {
    throw new Error(
      "Plaid credentials not configured. Set PLAID_CLIENT_ID and PLAID_SECRET environment variables, or configure them in billclaw settings."
    );
  }

  const plaidEnvMap: Record<string, string> = {
    sandbox: PlaidEnvironments.sandbox,
    development: PlaidEnvironments.development,
    production: PlaidEnvironments.production,
  };

  return {
    clientId,
    secret,
    environment: plaidEnvMap[environment] || PlaidEnvironments.sandbox,
  };
}

/**
 * Create Plaid Link token for initializing Link frontend
 */
export async function createLinkToken(
  context: OpenClawPluginApi,
  accountId?: string
): Promise<CreateLinkTokenResult> {
  try {
    const { clientId, secret, environment } = getPlaidConfig(context);

    const configuration = new Configuration({
      basePath: environment,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    });

    const plaidClient = new PlaidApi(configuration);

    const request: LinkTokenCreateRequest = {
      user: {
        client_user_id: accountId || "user_" + Date.now(),
      },
      client_name: "billclaw",
      products: ["transactions" as any],
      country_codes: ["US" as any],
      language: "en",
    };

    const axiosResponse = await plaidClient.linkTokenCreate(request);
    const response: LinkTokenCreateResponse = axiosResponse.data;

    context.logger.info("Plaid Link token created successfully");

    return {
      success: true,
      linkToken: response.link_token,
    };
  } catch (error) {
    context.logger.error("Failed to create Plaid Link token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Exchange Plaid public token for access token
 */
export async function exchangePublicToken(
  context: OpenClawPluginApi,
  publicToken: string
): Promise<{ accessToken: string; itemId: string } | null> {
  try {
    const { clientId, secret, environment } = getPlaidConfig(context);

    const configuration = new Configuration({
      basePath: environment,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    });

    const plaidClient = new PlaidApi(configuration);

    const request: ItemPublicTokenExchangeRequest = {
      public_token: publicToken,
    };

    const axiosResponse = await plaidClient.itemPublicTokenExchange(request);
    const response: ItemPublicTokenExchangeResponse = axiosResponse.data;

    context.logger.info("Plaid public token exchanged successfully");

    return {
      accessToken: response.access_token,
      itemId: response.item_id,
    };
  } catch (error) {
    context.logger.error("Failed to exchange Plaid public token:", error);
    return null;
  }
}

/**
 * Handle Plaid Link OAuth flow
 *
 * This integrates Plaid Link (https://plaid.com/docs/link/)
 * for secure bank account connection.
 *
 * Flow:
 * 1. Create Link token
 * 2. Serve Plaid Link frontend (or provide token for external UI)
 * 3. Handle Link success callback (receives public_token)
 * 4. Exchange public_token for access_token
 * 5. Return itemId and accessToken for storage
 */
export async function plaidOAuth(
  context: OpenClawPluginApi,
  publicToken?: string
): Promise<PlaidOAuthResult> {
  if (!publicToken) {
    // No public token provided - create Link token for initializing Link
    const result = await createLinkToken(context);

    if (!result.success || !result.linkToken) {
      return {
        success: false,
        error: result.error || "Failed to create Link token",
      };
    }

    // Return the Link token - caller will use it to render Plaid Link
    return {
      success: true,
    };
  }

  // Public token provided - exchange for access token
  const exchangeResult = await exchangePublicToken(context, publicToken);

  if (!exchangeResult) {
    return {
      success: false,
      error: "Failed to exchange public token for access token",
    };
  }

  return {
    success: true,
    itemId: exchangeResult.itemId,
    accessToken: exchangeResult.accessToken,
  };
}
