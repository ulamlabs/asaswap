import { SignType, TransactionType } from '@algorand-builder/runtime/build/types.js';

export function setupAssets(runtime, account) {
  return {
    primaryAssetId: setupPrimaryAsset(runtime, account),
    secondaryAssetId: setupSecondaryAsset(runtime, account),
    invalidAssetId: setupInvalidAsset(runtime, account),
    liquidityAssetId: setupLiquidityToken(runtime, account)
  };
}

function setupPrimaryAsset(runtime, account) {
  account.addAsset(111, 'ANOTHER', {
    creator: 'addr-1',
    total: 9007199254740991 * 10e6,
    decimals: 6,
    defaultFrozen: false,
    unitName: 'ASSET',
    name: 'ASSET',
    url: 'assetUrl',
    metadataHash: 'hash',
    manager: 'addr-1',
    reserve: 'addr-2',
    freeze: 'addr-3',
    clawback: 'addr-4'
  });
  runtime.store.assetDefs.set(111, account.address);
  return 111;
}

function setupSecondaryAsset(runtime, account) {
  account.addAsset(123, 'ASSET', {
    creator: 'addr-1',
    total: 9007199254740991 * 10e6,
    decimals: 6,
    defaultFrozen: false,
    unitName: 'ASSET',
    name: 'ASSET',
    url: 'assetUrl',
    metadataHash: 'hash',
    manager: 'addr-1',
    reserve: 'addr-2',
    freeze: 'addr-3',
    clawback: 'addr-4'
  });
  runtime.store.assetDefs.set(123, account.address);
  return 123;
}

function setupInvalidAsset(runtime, account) {
  account.addAsset(100, 'INVALID', {
    creator: 'addr-1',
    total: 9007199254740991 * 10e6,
    decimals: 6,
    defaultFrozen: false,
    unitName: 'ASSET',
    name: 'ASSET',
    url: 'assetUrl',
    metadataHash: 'hash',
    manager: 'addr-1',
    reserve: 'addr-2',
    freeze: 'addr-3',
    clawback: 'addr-4'
  });
  runtime.store.assetDefs.set(100, account.address);
  return 100;
}

export function fundAccounts(runtime, fundingAccount, accounts, assets, amount=1000000) {
  function fund(assetId, account) {
    runtime.optIntoASA(assetId, account.address, {});
    let tx = [
      {
        type: TransactionType.TransferAsset,
        assetID: assetId,
        sign: SignType.SecretKey,
        fromAccount: fundingAccount.account,
        toAccountAddr: account.address,
        amount: amount,
        payFlags: {
          totalFee: 1000
        }
      }
    ];
    runtime.executeTx(tx);
  }
  accounts.forEach((account) => {
    Object.keys(assets).forEach((key) => {
      fund(assets[key], account);
    });
  });
}

export function setupLiquidityToken(runtime, account) {
  const assetId = runtime.addAsset('liquidity_token', { creator: account.account });
  const rawAsset = account.createdAssets.get(assetId);
  rawAsset['manager'] = account.address;
  rawAsset['reserve'] = account.address;
  rawAsset['freeze'] = account.address;
  rawAsset['clawback'] = account.address;
  return assetId;
}
