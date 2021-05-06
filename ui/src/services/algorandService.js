import algosdk from 'algosdk';
import eventBus from '@/utils/eventBus';
import { validateTx } from '@/utils/validation';
import {
  TransactionMaker,
  encodeArrayForSDK,
} from '@/utils/transactions';
import { AlgoExplorer } from '@/services/algoExplorer';
import { AlgoSigner } from '@/services/algoSigner';
import {
  ADD_LIQUIDITY, DEPOSIT_LIQUIDITY,
  REMOVE_LIQUIDITY,
  SWAP,
  WITHDRAW,
  WITHDRAW_LIQUIDITY,
  CALC_ADD_LIQ,
  CALC_ADD_LIQ_B,
  CALC_SWAP_A,
  CALC_SWAP_B,
  CALC_REM_LIQ_A,
  CALC_REM_LIQ_B,
  CALC_SLOT_1,
  CALC_SLOT_2
} from '@/utils/constants';
import {  } from '../utils/constants';

export default class AlgorandService {
  constructor(signer, ledger, assetPair) {
    this.signer = new AlgoSigner(signer);
    this.ledger = ledger;
    this.assetPair = assetPair;
    this.txMaker = new TransactionMaker(assetPair);
  }

  setAssetPair(assetPair) {
    this.assetPair = assetPair;
    this.txMaker.setAssetPair(assetPair);
  }

  connect() {
    return this.signer.connect();
  }

  getAccounts() {
    return this.signer.accounts({
      ledger: this.ledger
    });
  }

  getAccountData(accountAddress) {
    return this.signer.algod({
      ledger: this.ledger,
      path: `/v2/accounts/${accountAddress}`
    });
  }

  static async getApplicationData(ledger, applicationId) {
    const explorer = new AlgoExplorer(ledger);
    return explorer.fetch(`/v2/applications/${applicationId}`);
  }

  getSuggestedParams() {
    return this.signer.algod({
      ledger: this.ledger,
      path: '/v2/transactions/params'
    });
  }

  async optInApp(accountAddress) {
    const suggestedParams = await this.getSuggestedParams();
    const optInTxn = this.txMaker.makeOptInTx(accountAddress, suggestedParams);
    await validateTx([optInTxn]);
    eventBus.$emit('set-action-message', 'Signing application opt-in...');
    const signedTx = await this.signer.sign(optInTxn);
    eventBus.$emit('set-action-message', 'Sending application opt-in...');
    return await this.signer.send({
      ledger: this.ledger,
      tx: signedTx.blob
    }, false);
  }

  async optInAsset(asset, accountAddress) {
    const suggestedParams = await this.getSuggestedParams();
    const optInTxn = this.txMaker.makeAssetOptInTx(asset, accountAddress, suggestedParams);
    await validateTx([optInTxn]);
    eventBus.$emit('set-action-message', 'Signing asset opt-in...');
    const signedTx = await this.signer.sign(optInTxn);
    eventBus.$emit('set-action-message', 'Sending asset opt-in...');
    return await this.signer.send({
      ledger: this.ledger,
      tx: signedTx.blob
    }, false);
  }

  async addLiquidity(accountAddress, primaryAssetAmount, secondaryAssetAmount) {
    const suggestedParams = await this.getSuggestedParams();
    const tx1 = this.txMaker.makeMuldivCallTx(accountAddress, [CALC_ADD_LIQ, CALC_SLOT_1], suggestedParams);
    const tx2 = this.txMaker.makeMuldivCallTx(accountAddress, [CALC_ADD_LIQ_B, CALC_SLOT_2], suggestedParams);
    const tx3 = this.txMaker.makeCallTx(accountAddress, [ADD_LIQUIDITY], suggestedParams);
    const tx4 = this.txMaker.makePrimaryAssetDepositTx(accountAddress, primaryAssetAmount, suggestedParams);
    const tx5 = this.txMaker.makeSecondaryAssetDepositTx(accountAddress, secondaryAssetAmount, suggestedParams);
    await validateTx([tx1, tx2, tx3, tx4, tx5]);
    const txnGroup = await algosdk.assignGroupID([
      {
        ...tx1,
        appArgs: encodeArrayForSDK([CALC_ADD_LIQ, CALC_SLOT_1])
      },
      {
        ...tx2,
        appArgs: encodeArrayForSDK([CALC_ADD_LIQ_B, CALC_SLOT_2])
      },
      {
        ...tx3,
        appArgs: encodeArrayForSDK([ADD_LIQUIDITY])
      },
      Object.assign({}, tx4),
      Object.assign({}, tx5)
    ]);
    tx1.group = txnGroup[0].group.toString('base64');
    tx2.group = txnGroup[1].group.toString('base64');
    tx3.group = txnGroup[2].group.toString('base64');
    tx4.group = txnGroup[3].group.toString('base64');
    tx5.group = txnGroup[4].group.toString('base64');
    eventBus.$emit('set-action-message', 'Signing 1 of 5 liquidity transactions...');
    const signedTx1 = await this.signer.sign(tx1);
    eventBus.$emit('set-action-message', 'Signing 2 of 5 liquidity transactions...');
    const signedTx2 = await this.signer.sign(tx2);
    eventBus.$emit('set-action-message', 'Signing 3 of 5 liquidity transactions...');
    const signedTx3 = await this.signer.sign(tx3);
    eventBus.$emit('set-action-message', 'Signing 4 of 5 liquidity transactions...');
    const signedTx4 = await this.signer.sign(tx4);
    eventBus.$emit('set-action-message', 'Signing 5 of 5 liquidity transactions...');
    const signedTx5 = await this.signer.sign(tx5);
    eventBus.$emit('set-action-message', 'Sending liquidity transactions...');
    return await this.signer.send({
      ledger: this.ledger,
      tx: this.txMaker.combineSignedTxs([signedTx1, signedTx2, signedTx3, signedTx4, signedTx5])
    }, false);
  }

  async removeLiquidity(accountAddress, liquidityTokens) {
    const suggestedParams = await this.getSuggestedParams();
    const tx1 = this.txMaker.makeMuldivCallTx(accountAddress, [CALC_REM_LIQ_A, CALC_SLOT_1], suggestedParams);
    const tx2 = this.txMaker.makeMuldivCallTx(accountAddress, [CALC_REM_LIQ_B, CALC_SLOT_2], suggestedParams);
    const tx3 = this.txMaker.makeCallTx(accountAddress, [REMOVE_LIQUIDITY, Number(liquidityTokens)], suggestedParams);
    await validateTx([tx1, tx2, tx3]);
    const txnGroup = await algosdk.assignGroupID([
      {
        ...tx1,
        appArgs: encodeArrayForSDK([CALC_REM_LIQ_A, CALC_SLOT_1])
      },
      {
        ...tx2,
        appArgs: encodeArrayForSDK([CALC_REM_LIQ_B, CALC_SLOT_2])
      },
      {
        ...tx3,
        appArgs: encodeArrayForSDK([REMOVE_LIQUIDITY, Number(liquidityTokens)])
      }
    ]);
    tx1.group = txnGroup[0].group.toString('base64');
    tx2.group = txnGroup[1].group.toString('base64');
    tx3.group = txnGroup[2].group.toString('base64');

    eventBus.$emit('set-action-message', 'Signing 1 of 3 liquidity transactions...');
    const signedTx1 = await this.signer.sign(tx1);
    eventBus.$emit('set-action-message', 'Signing 2 of 3 liquidity transactions...');
    const signedTx2 = await this.signer.sign(tx2);
    eventBus.$emit('set-action-message', 'Signing 3 of 3 liquidity transactions...');
    const signedTx3 = await this.signer.sign(tx3);

    eventBus.$emit('set-action-message', 'Sending liquidity transactions...');
    return await this.signer.send({
      ledger: this.ledger,
      tx: this.txMaker.combineSignedTxs([signedTx1, signedTx2, signedTx3])
    }, false);
  }

  async swapSecondary(accountAddress, assetAmount, minRequested) {
    const suggestedParams = await this.getSuggestedParams();
    const tx1 = this.txMaker.makeMuldivCallTx(accountAddress, [CALC_SWAP_B, CALC_SLOT_1], suggestedParams);
    const tx2 = this.txMaker.makeCallTx(accountAddress, [SWAP, minRequested], suggestedParams);
    const tx3 = this.txMaker.makeSecondaryAssetDepositTx(accountAddress, assetAmount, suggestedParams);
    await validateTx([tx1, tx2, tx3]);
    const txnGroup = await algosdk.assignGroupID([
      {
        ...tx1,
        appArgs: encodeArrayForSDK([CALC_SWAP_B, CALC_SLOT_1])
      },
      {
        ...tx2,
        appArgs: encodeArrayForSDK([SWAP, minRequested])
      },
      Object.assign({}, tx3)
    ]);
    tx1.group = txnGroup[0].group.toString('base64');
    tx2.group = txnGroup[1].group.toString('base64');
    tx3.group = txnGroup[2].group.toString('base64');
    eventBus.$emit('set-action-message', 'Signing 1 of 3 swap transactions...');
    const signedTx1 = await this.signer.sign(tx1);
    eventBus.$emit('set-action-message', 'Signing 2 of 3 swap transactions...');
    const signedTx2 = await this.signer.sign(tx2);
    eventBus.$emit('set-action-message', 'Signing 3 of 3 swap transactions...');
    const signedTx3 = await this.signer.sign(tx3);
    eventBus.$emit('set-action-message', 'Sending swap transactions...');
    return await this.signer.send({
      ledger: this.ledger,
      tx: this.txMaker.combineSignedTxs([signedTx1, signedTx2, signedTx3])
    }, false);
  }

  async swapPrimary(accountAddress, assetAmount, minRequested) {
    const suggestedParams = await this.getSuggestedParams();
    const tx1 = this.txMaker.makeMuldivCallTx(accountAddress, [CALC_SWAP_A, CALC_SLOT_1], suggestedParams);
    const tx2 = this.txMaker.makeCallTx(accountAddress, [SWAP, minRequested], suggestedParams);
    const tx3 = this.txMaker.makePrimaryAssetDepositTx(accountAddress, assetAmount, suggestedParams);
    await validateTx([tx1, tx2, tx3]);
    const txnGroup = await algosdk.assignGroupID([
      {
        ...tx1,
        appArgs: encodeArrayForSDK([CALC_SWAP_A, CALC_SLOT_1])
      },
      {
        ...tx2,
        appArgs: encodeArrayForSDK([SWAP, minRequested])
      },
      Object.assign({}, tx3)
    ]);
    tx1.group = txnGroup[0].group.toString('base64');
    tx2.group = txnGroup[1].group.toString('base64');
    tx3.group = txnGroup[2].group.toString('base64');
    eventBus.$emit('set-action-message', 'Signing 1 of 3 swap transactions...');
    const signedTx1 = await this.signer.sign(tx1);
    eventBus.$emit('set-action-message', 'Signing 2 of 3 swap transactions...');
    const signedTx2 = await this.signer.sign(tx2);
    eventBus.$emit('set-action-message', 'Signing 3 of 3 swap transactions...');
    const signedTx3 = await this.signer.sign(tx3);
    eventBus.$emit('set-action-message', 'Sending swap transactions...');
    return await this.signer.send({
      ledger: this.ledger,
      tx: this.txMaker.combineSignedTxs([signedTx1, signedTx2, signedTx3])
    }, false);
  }

  async depositLiquidity(accountAddress, assetAmount) {
    const suggestedParams = await this.getSuggestedParams();
    const tx1 = this.txMaker.makeCallTx(accountAddress, [DEPOSIT_LIQUIDITY], suggestedParams);
    const tx2 = this.txMaker.makeAssetPaymentTx(this.assetPair.liquidityAsset, accountAddress, this.assetPair.escrowAddress, assetAmount, suggestedParams);
    await validateTx([tx1, tx2]);
    const txnGroup = await algosdk.assignGroupID([
      {
        ...tx1,
        appArgs: encodeArrayForSDK([DEPOSIT_LIQUIDITY])
      },
      Object.assign({}, tx2),
    ]);
    tx1.group = txnGroup[0].group.toString('base64');
    tx2.group = txnGroup[1].group.toString('base64');
    eventBus.$emit('set-action-message', 'Signing 1 of 2 deposit transactions...');
    const signedTx1 = await this.signer.sign(tx1);
    eventBus.$emit('set-action-message', 'Signing 2 of 2 deposit transactions...');
    const signedTx2 = await this.signer.sign(tx2);
    eventBus.$emit('set-action-message', 'Sending deposit transactions...');
    return await this.signer.send({
      ledger: this.ledger,
      tx: this.txMaker.combineSignedTxs([signedTx1, signedTx2])
    });
  }

  async withdrawLiquidity(accountAddress, assetAmount) {
    const suggestedParams = await this.getSuggestedParams();
    const tx1 = this.txMaker.makeCallTx(accountAddress, [WITHDRAW_LIQUIDITY], suggestedParams);
    const tx2 = this.txMaker.makeAssetWithdrawalTx(this.assetPair.liquidityAsset, accountAddress, assetAmount, suggestedParams);
    const tx3 = this.txMaker.makeAlgoPaymentTx(accountAddress, this.assetPair.escrowAddress, 1000, suggestedParams);
    await validateTx([tx1, tx2, tx3]);
    const txnGroup = await algosdk.assignGroupID([
      {
        ...tx1,
        appArgs: encodeArrayForSDK([WITHDRAW_LIQUIDITY])
      },
      tx2,
      tx3
    ]);
    tx1.group = txnGroup[0].group.toString('base64');
    tx3.group = txnGroup[2].group.toString('base64');
    eventBus.$emit('set-action-message', 'Signing 1 of 2 withdrawal transactions...');
    const signedTx1 = await this.signer.sign(tx1);
    const signedTx2 = this.txMaker.logicSign(txnGroup[1]);
    eventBus.$emit('set-action-message', 'Signing 2 of 2 withdrawal transactions...');
    const signedTx3 = await this.signer.sign(tx3);
    eventBus.$emit('set-action-message', 'Sending withdrawal transactions...');
    return await this.signer.send({
      ledger: this.ledger,
      tx: this.txMaker.combineSignedTxs([signedTx1, signedTx2, signedTx3])
    });
  }

  async withdraw(accountAddress, primaryAssetAmount, secondaryAssetAmount) {
    const suggestedParams = await this.getSuggestedParams();
    const tx1 = this.txMaker.makeCallTx(accountAddress, [WITHDRAW], suggestedParams);
    const tx2 = this.txMaker.makeSecondaryAssetWithdrawalTx(accountAddress, secondaryAssetAmount, suggestedParams);
    const tx3 = this.txMaker.makePrimaryAssetWithdrawalTx(accountAddress, primaryAssetAmount, suggestedParams);
    const tx4 = this.txMaker.makeAlgoPaymentTx(accountAddress, this.assetPair.escrowAddress, 2000, suggestedParams);
    await validateTx([tx1, tx2, tx3, tx4]);
    const txnGroup = await algosdk.assignGroupID([
      {
        ...tx1,
        appArgs: encodeArrayForSDK([WITHDRAW])
      },
      tx2,
      tx3,
      Object.assign({}, tx4)
    ]);
    tx1.group = txnGroup[0].group.toString('base64');
    tx4.group = txnGroup[3].group.toString('base64');
    eventBus.$emit('set-action-message', 'Signing 1 of 2 withdrawal transactions...');
    const signedTx1 = await this.signer.sign(tx1);
    const signedTx2 = this.txMaker.logicSign(txnGroup[1]);
    const signedTx3 = this.txMaker.logicSign(txnGroup[2]);
    eventBus.$emit('set-action-message', 'Signing 2 of 2 withdrawal transactions...');
    const signedTx4 = await this.signer.sign(tx4);
    eventBus.$emit('set-action-message', 'Sending withdrawal transactions...');
    return await this.signer.send({
      ledger: this.ledger,
      tx: this.txMaker.combineSignedTxs([signedTx1, signedTx2, signedTx3, signedTx4])
    });
  }
}
