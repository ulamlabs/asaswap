import { Buffer } from 'buffer';
import algosdk from 'algosdk';
import { ALGOS_TO_ASA } from '@/utils/assetPairs';

export function encodeArrayForSDK(decodedArray) {
  const encoder = new TextEncoder('ascii');
  return decodedArray.map((value) => {
    if(typeof(value) === 'number') {
      // uint64ToBigEndian doesn't quite return the Uint8Array and needs to be converted
      // That array has proto: UInt8Array, while needed is TypedArray
      return new Uint8Array(uint64ToBigEndian(value));
    }
    return encoder.encode(value);
  });
}

function uint64ToBigEndian(x) {
  const buff = Buffer.alloc(8);
  buff.writeUIntBE(x, 0, 8);
  return buff;
}

function encodeArrayForSigner(decodedArray) {
  return decodedArray.map((value) => {
    if (typeof value === 'number') {
      return btoa(String.fromCharCode.apply(null, uint64ToBigEndian(value)));
    }
    return btoa(value);
  });
}

export class TransactionMaker {
  constructor(assetPair) {
    this.assetPair = assetPair;
  }

  setAssetPair(assetPair) {
    this.assetPair = assetPair;
  }

  makeOptInTx(accountAddress, suggestedParams) {
    return {
      from: accountAddress,
      type: 'appl',
      fee: suggestedParams['min-fee'],
      firstRound: suggestedParams['last-round'],
      lastRound: suggestedParams['last-round'] + 1000,
      genesisID: suggestedParams['genesis-id'],
      genesisHash: suggestedParams['genesis-hash'],
      flatFee: true,
      appIndex: this.assetPair.applicationId,
      appOnComplete: 1 // OptInOC
    };
  }

  makeCallTx(accountAddress, appArgs, suggestedParams) {
    return {
      from: accountAddress,
      type: 'appl',
      fee: suggestedParams['min-fee'],
      firstRound: suggestedParams['last-round'],
      lastRound: suggestedParams['last-round'] + 1000,
      genesisID: suggestedParams['genesis-id'],
      genesisHash: suggestedParams['genesis-hash'],
      flatFee: true,
      appIndex: this.assetPair.applicationId,
      appForeignApps: [this.assetPair.muldivAppId],
      appArgs: encodeArrayForSigner(appArgs)
    };
  }

  makeMuldivCallTx(accountAddress, appArgs, suggestedParams) {
    return {
      from: accountAddress,
      type: 'appl',
      fee: suggestedParams['min-fee'],
      firstRound: suggestedParams['last-round'],
      lastRound: suggestedParams['last-round'] + 1000,
      genesisID: suggestedParams['genesis-id'],
      genesisHash: suggestedParams['genesis-hash'],
      flatFee: true,
      appIndex: this.assetPair.muldivAppId,
      appForeignApps: [this.assetPair.applicationId],
      appArgs: encodeArrayForSigner(appArgs)
    };
  }

  makePrimaryAssetDepositTx(accountAddress, amount, suggestedParams) {
    if (this.assetPair.type === ALGOS_TO_ASA) {
      return this.makeAlgoPaymentTx(accountAddress, this.assetPair.escrowAddress, amount, suggestedParams);
    } else {
      return this.makeAssetPaymentTx(this.assetPair.primaryAsset, accountAddress, this.assetPair.escrowAddress, amount, suggestedParams);
    }
  }

  makeAlgoPaymentTx(accountAddress, toAddress, amount, suggestedParams) {
    return {
      type: 'pay',
      from: accountAddress,
      to: toAddress,
      fee: suggestedParams['min-fee'],
      firstRound: suggestedParams['last-round'],
      lastRound: suggestedParams['last-round'] + 1000,
      genesisID: suggestedParams['genesis-id'],
      genesisHash: suggestedParams['genesis-hash'],
      flatFee: true,
      amount: Number(amount)
    };
  }

  makeAssetOptInTx(asset, accountAddress, suggestedParams) {
    return this.makeAssetPaymentTx(asset, accountAddress, accountAddress, 0, suggestedParams);
  }

  makeSecondaryAssetDepositTx(accountAddress, amount, suggestedParams) {
    return this.makeAssetPaymentTx(this.assetPair.secondaryAsset, accountAddress, this.assetPair.escrowAddress, amount, suggestedParams);
  }

  makeSecondaryAssetWithdrawalTx(accountAddress, amount, suggestedParams) {
    return this.makeAssetWithdrawalTx(this.assetPair.secondaryAsset, accountAddress, amount, suggestedParams);
  }

  makePrimaryAssetWithdrawalTx(accountAddress, amount, suggestedParams) {
    if (this.assetPair.type === ALGOS_TO_ASA) {
      return this.makeAlgosWithdrawalTx(accountAddress, amount, suggestedParams);
    } else {
      return this.makeAssetWithdrawalTx(this.assetPair.primaryAsset, accountAddress, amount, suggestedParams);
    }
  }

  makeAssetWithdrawalTx(asset, accountAddress, amount, suggestedParams) {
    return algosdk.makeAssetTransferTxnWithSuggestedParams(
      this.assetPair.escrowAddress,
      accountAddress,
      undefined,
      undefined,
      amount,
      undefined,
      asset.assetIndex,
      this.convertParamsToSDKFormat(suggestedParams)
    );
  }

  makeAlgosWithdrawalTx(accountAddress, amount, suggestedParams) {
    return algosdk.makePaymentTxnWithSuggestedParams(
      this.assetPair.escrowAddress,
      accountAddress,
      amount,
      undefined,
      undefined,
      this.convertParamsToSDKFormat(suggestedParams)
    );
  }

  makeAssetPaymentTx(asset, accountAddress, toAddress, amount, suggestedParams) {
    return {
      type: 'axfer',
      from: accountAddress,
      to: toAddress,
      fee: suggestedParams['min-fee'],
      firstRound: suggestedParams['last-round'],
      lastRound: suggestedParams['last-round'] + 1000,
      genesisID: suggestedParams['genesis-id'],
      genesisHash: suggestedParams['genesis-hash'],
      flatFee: true,
      amount: Number(amount),
      assetIndex: asset.assetIndex
    };
  }

  convertParamsToSDKFormat(suggestedParams) {
    return {
      consensusVersion: suggestedParams['consensus-version'],
      fee: suggestedParams['fee'],
      genesisHash: suggestedParams['genesis-hash'],
      genesisID: suggestedParams['genesis-id'],
      firstRound: suggestedParams['last-round'],
      lastRound: suggestedParams['last-round'] + 1000,
      flatFee: true,
      minFee: suggestedParams['min-fee']
    };
  }

  combineSignedTxs(txs) {
    const decodedTxs = txs.map((tx) => {
      if (tx.blob instanceof Uint8Array) {
        return tx.blob;
      } else {
        return new Uint8Array(atob(tx.blob).split('').map(x => x.charCodeAt(0)));
      }
    });
    const totalLength = decodedTxs.reduce((previousValue, currentValue) => {
      return previousValue + currentValue.byteLength;
    }, 0);
    const combinedTxs = new Uint8Array(totalLength);
    let byteLength = 0;
    for (let tx=0; tx < decodedTxs.length; tx++) {
      combinedTxs.set(new Uint8Array(decodedTxs[tx]), byteLength);
      byteLength += decodedTxs[tx].byteLength;
    }
    return btoa(String.fromCharCode.apply(null, combinedTxs));
  }

  logicSign(tx) {
    const program = new Uint8Array(Buffer.from(this.assetPair.compiledEscrow, 'base64'));
    const lSig = algosdk.makeLogicSig(program);
    return algosdk.signLogicSigTransactionObject(tx, lSig);
  }
}
