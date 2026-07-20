export interface MonnifyResponse {
    requestSuccessful: boolean;
    responseMessage: string;
    responseCode: string | number;
    responseBody?: any;
}

export interface MonnifyBanks {
    name: string;
    code: string;
    ussdTemplate: null;
    baseUssdCode: null;
    transferUssdTemplate: null;
}

export interface MonnifyBankInfo {
    accountNumber: string;
    accountName: string;
    bankCode: string;
}

export interface GetBanksResponse extends MonnifyResponse {
    responseBody: MonnifyBanks[];
}

export interface ResolveBankAccountResponse extends MonnifyResponse {
    responseBody: MonnifyBankInfo;
}

export interface MonnifyWalletBalance {
    availableBalance: number;
    ledgerBalance: number;
    accountNumber: string;
    currency: string;
}

export interface GetWalletBalanceResponse extends MonnifyResponse {
    responseBody: MonnifyWalletBalance;
}

// Field names beyond these are documented inconsistently across Monnify's
// SDKs/docs — kept loose with an index signature rather than over-committing
// to an unverified shape.
export interface MonnifyTransaction {
    transactionReference: string;
    paymentReference: string;
    amountPaid: number;
    totalPayable: number;
    settlementAmount?: number;
    paidOn?: string;
    paymentStatus: 'PAID' | 'PENDING' | 'OVERPAID' | 'PARTIALLY_PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
    paymentMethod?: string;
    currencyCode?: string;
    customer?: { email?: string; name?: string };
    [key: string]: unknown;
}

export interface GetTransactionResponse extends MonnifyResponse {
    responseBody: MonnifyTransaction;
}

export interface MonnifyTransactionSearchResult {
    content: MonnifyTransaction[];
    totalElements?: number;
    totalPages?: number;
    [key: string]: unknown;
}

export interface SearchTransactionsResponse extends MonnifyResponse {
    responseBody: MonnifyTransactionSearchResult;
}

export interface InitTransactionRequest {
    amount: number;
    currencyCode: 'NGN';
    contractCode: string;
    customerName: string;
    customerEmail: string;
    paymentReference: string;
    paymentDescription: string;
    paymentMethods: string[];
    redirectUrl?: string;
    merchantName?: string;
    checkoutUrl?: string;
}

export interface InitTransactionResponseBody {
    transactionReference: string;
    paymentReference: string;
    accountNumber: string;
    accountBankCode: string;
    accountBankName?: string;
    expiresAt: string;
    amount: number;
    [key: string]: unknown;
}

export interface InitTransactionResponse extends MonnifyResponse {
    responseBody: InitTransactionResponseBody;
}

export interface InitiateRefundRequest {
    refundReference: string;
    transactionReference: string;
    refundAmount: number;
    refundReason: string;
    customerNote: string;
}

export interface InitiateRefundResponseBody {
    refundReference: string;
    transactionReference: string;
    refundAmount: number;
    refundStatus: string;
    [key: string]: unknown;
}

export interface InitiateRefundResponse extends MonnifyResponse {
    responseBody: InitiateRefundResponseBody;
}

export interface InitiateSingleTransferRequest {
    amount: number;
    reference: string;
    narration: string;
    destinationBankCode: string;
    destinationAccountNumber: string;
    currency: 'NGN';
    async: true;
    destinationAccountName?: string;
    sourceAccountNumber?: string;
}

export interface InitiateSingleTransferResponseBody {
    reference: string;
    status: string;
    amount: number;
    dateCreated?: string;
    destinationAccountNumber: string;
    destinationBankCode: string;
    destinationAccountName?: string;
    transactionReference?: string;
    [key: string]: unknown;
}

export interface InitiateSingleTransferResponse extends MonnifyResponse {
    responseBody: InitiateSingleTransferResponseBody;
}

export interface MonnifyTransactionSearchParams {
    paymentReference?: string;
    transactionReference?: string;
    customerName?: string;
    customerEmail?: string;
    paymentStatus?: MonnifyTransaction['paymentStatus'];
    /** Format: DD/MM/YYYY */
    from?: string;
    /** Format: DD/MM/YYYY */
    to?: string;
    amount?: number;
    page?: number;
    size?: number;
}