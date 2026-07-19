import { generateMonnifyBase64AuthKey } from "../../helpers/monnify";
import axios from "axios";
import {
    GetBanksResponse,
    GetTransactionResponse,
    GetWalletBalanceResponse,
    InitTransactionRequest,
    InitTransactionResponse,
    InitTransactionResponseBody,
    MonnifyResponse,
    MonnifyTransaction,
    MonnifyTransactionSearchParams,
    MonnifyTransactionSearchResult,
    MonnifyWalletBalance,
    ResolveBankAccountResponse,
    SearchTransactionsResponse,
} from "../../types/monnify";

const baseUrl: string = process.env['MONNIFY_BASE_URL'] ?? 'https://sandbox.monnify.com/api/v1';
const apikey: string = process.env['MONNIFY_API_KEY'] ?? '';
const secretKey: string = process.env['MONNIFY_SECRET_KEY'] ?? '';
const contractCode: string = process.env['MONNIFY_MERCHANT_CODE'] ?? '';
const defaultWalletAccountNumber: string = process.env['MONNIFY_MERCHANT_ACCOUNT_NUMBER'] ?? '';
const redirectUrl: string = process.env['MONNIFY_REDIRECT_URL'] ?? '';

// baseUrl is pinned to /api/v1 (see above), but wallet/transaction-query
// endpoints live under /api/v2 — derive a bare root so those can build
// their own versioned path without disturbing the v1 endpoints above.
const rootUrl: string = baseUrl.replace(/\/api\/v\d+\/?$/, '');
const v2Url = (path: string): string => `${rootUrl}/api/v2${path}`;

export const generateAuth = async (): Promise<string> => {
    const url: string = `${baseUrl}/auth/login`;
    const base64Auth: string = generateMonnifyBase64AuthKey(apikey, secretKey);
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${base64Auth}`,
    };
    const { data: { responseBody }} = await axios.post<MonnifyResponse>(url, {}, { headers });
    return responseBody.accessToken
}

export const getBankList = async (): Promise<GetBanksResponse> => {
    const url: string = `${baseUrl}/banks`;
    const authToken: string = await generateAuth();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
    };
    const response = await axios.get<GetBanksResponse>(url, { headers });
    return response.data;
}

export const resolveBankAccount = async (accountNumber: string, bankCode: string): Promise<ResolveBankAccountResponse> => {
    const url: string = `${baseUrl}/disbursements/account/validate`;
    const authToken: string = await generateAuth();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
    };
    const params = {
        accountNumber,
        bankCode,
    };
    const response = await axios.get<ResolveBankAccountResponse>(url, { headers, params });
    return response.data;
}

/**
 * POST /api/v1/merchant/transactions/init-transaction — generate a unique,
 * time-boxed (~40 min) dynamic virtual account for a single contribution.
 * `amountKobo` must already be in kobo (see helpers/monnify.ts#toKobo).
 */
export const initTransaction = async (params: {
    amount: number;
    paymentReference: string;
    customerName: string;
    customerEmail: string;
    paymentDescription: string;
    paymentMethods: string[]
}): Promise<InitTransactionResponseBody> => {
    console.log({ contractCode });
    if (!contractCode) {
        throw new Error('Set MONNIFY_MERCHANT_CODE to initiate transactions');
    }

    const url: string = `${baseUrl}/merchant/transactions/init-transaction`;
    const authToken: string = await generateAuth();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
    };
    const body: InitTransactionRequest = {
        amount: params.amount,
        currencyCode: 'NGN',
        contractCode,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        paymentReference: params.paymentReference,
        paymentDescription: params.paymentDescription,
        paymentMethods: params.paymentMethods,
        redirectUrl: redirectUrl
    };

    const response = await axios.post<InitTransactionResponse>(url, body, { headers });
    return response.data.responseBody;
}

/**
 * GET /api/v1/transactions/search — lists/searches all transactions for the
 * merchant, optionally filtered by any of the given params.
 *
 * NOTE: Monnify's docs render endpoint parameters client-side and couldn't be
 * fully scraped, so the filter param names above are the commonly documented
 * set — verify against the Monnify API reference/Postman collection before
 * relying on filters beyond paymentReference/transactionReference.
 */
export const getAllMerchantTransactions = async (
    params: MonnifyTransactionSearchParams = {},
): Promise<MonnifyTransactionSearchResult> => {
    const url: string = `${baseUrl}/transactions/search`;
    const authToken: string = await generateAuth();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
    };
    const response = await axios.get<SearchTransactionsResponse>(url, { headers, params });
    return response.data.responseBody;
}

/** GET /api/v2/merchant/transactions/query?transactionReference=... — fetch a single transaction by Monnify's own reference. */
export const getSingleTransaction = async (transactionReference: string): Promise<MonnifyTransaction> => {
    const url: string = v2Url('/merchant/transactions/query');
    const authToken: string = await generateAuth();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
    };
    const response = await axios.get<GetTransactionResponse>(url, { headers, params: { transactionReference } });
    return response.data.responseBody;
}

/** GET /api/v2/merchant/transactions/query?paymentReference=... — check status using the paymentReference you generated at init. */
export const getTransactionStatus = async (paymentReference: string): Promise<MonnifyTransaction> => {
    const url: string = v2Url('/merchant/transactions/query');
    const authToken: string = await generateAuth();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
    };
    const response = await axios.get<GetTransactionResponse>(url, { headers, params: { paymentReference } });
    return response.data.responseBody;
}

/** GET /api/v2/disbursements/wallet-balance?accountNumber=... — available balance on the Monnify disbursement wallet. */
export const getWalletBalance = async (accountNumber: string = defaultWalletAccountNumber): Promise<MonnifyWalletBalance> => {
    if (!accountNumber) {
        throw new Error('Set MONNIFY_MERCHANT_ACCOUNT_NUMBER or pass an accountNumber explicitly');
    }

    const url: string = v2Url('/disbursements/wallet-balance');
    const authToken: string = await generateAuth();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
    };
    const response = await axios.get<GetWalletBalanceResponse>(url, { headers, params: { accountNumber } });
    return response.data.responseBody;
}