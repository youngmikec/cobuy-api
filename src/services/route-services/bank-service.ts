import { AppError } from "../../helpers/error";
import { getBankList, resolveBankAccount } from "../third-party-services/monnify";
import { ResolveBankAccountInput } from "../../schemas/bank.schema";

export const listBanksService = async () => {
    try {
        const { responseBody } = await getBankList();
        return responseBody;
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(502, 'MONNIFY_REQUEST_FAILED', `Failed to fetch banks: ${error.message}`);
    }
}

export const resolveBankAccountService = async (payload: ResolveBankAccountInput) => {
    try {
        const { accountNumber, bankCode } = payload;
        const { responseBody } = await resolveBankAccount(accountNumber, bankCode);
        return responseBody;
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(502, 'MONNIFY_REQUEST_FAILED', `Failed to resolve bank account: ${error.message}`);
    }
}
