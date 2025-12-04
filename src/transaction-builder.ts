import {
  AccountAddress,
  AccountAddressInput,
  AptosConfig,
  ChainId,
  convertPayloadToInnerPayload,
  EntryFunctionABI,
  findFirstNonSignerArg,
  generateTransactionPayloadWithABI,
  InputEntryFunctionData,
  InputEntryFunctionDataWithABI,
  MoveFunction,
  parseTypeTag,
  RawTransaction,
  SimpleTransaction,
  TypeTag,
} from "@aptos-labs/ts-sdk";

export function buildSimpleTransactionSync(args: {
  aptosConfig: AptosConfig;
  sender: AccountAddressInput;
  data: InputEntryFunctionData;
  chainId: number;
  gasUnitPrice: number;
  abi: MoveFunction;
  withFeePayer: boolean;
  replayProtectionNonce: bigint;
  timeDeltaMs?: number;
}) {
  const txnPayload = generateTransactionPayloadWithABI({
    aptosConfig: args.aptosConfig,
    function: args.data.function,
    functionArguments: args.data.functionArguments,
    typeArguments: args.data.typeArguments,
    abi: parseMoveFnAbiToEntryFnABI(args.abi),
  } as InputEntryFunctionDataWithABI);

  const expireTimestamp = generateExpireTimestamp(args.aptosConfig, args.timeDeltaMs);

  const rawTxn = new RawTransaction(
    AccountAddress.from(args.sender),
    // If replay nonce is provided, use it as the sequence number
    // This is an unused value, so it's specifically to show that the sequence number is not used
    BigInt("0xdeadbeef"),
    convertPayloadToInnerPayload(txnPayload, args.replayProtectionNonce),
    // @Todo: Use gasPriceManager to get the max gas amount [as defaultMaxGasAmount might be very high number]
    BigInt(args.aptosConfig.getDefaultMaxGasAmount()),
    BigInt(args.gasUnitPrice),
    BigInt(expireTimestamp),
    new ChainId(args.chainId),
  );

  return new SimpleTransaction(rawTxn, args.withFeePayer ? AccountAddress.ZERO : undefined);
}

const parseMoveFnAbiToEntryFnABI = (functionAbi: MoveFunction): EntryFunctionABI => {
  // Remove the signer arguments
  const numSigners = findFirstNonSignerArg(functionAbi);

  const params: TypeTag[] = [];
  for (let i = numSigners; i < functionAbi.params.length; i += 1) {
    const param = functionAbi.params[i];
    if (!param) continue;
    params.push(parseTypeTag(param, { allowGenerics: true }));
  }

  return {
    signers: numSigners,
    typeParameters: functionAbi.generic_type_params,
    parameters: params,
  };
};

export const generateExpireTimestamp = (aptosConfig: AptosConfig, timeDeltaMs = 0) =>
  Math.floor((Date.now() + timeDeltaMs) / 1000) + aptosConfig.getDefaultTxnExpirySecFromNow();
