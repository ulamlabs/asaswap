import { getProgram, stringToBytes } from '@algo-builder/algob';
import { SignType, TransactionType } from '@algo-builder/runtime/build/types.js';
import constants from '../../common/constants.js';

const {
  ADD_LIQUIDITY,
  DEPOSIT_LIQUIDITY,
  REMOVE_LIQUIDITY,
  SETUP_ESCROW,
  SWAP,
  UPDATE,
  WITHDRAW,
  WITHDRAW_LIQUIDITY
} = constants;

export const ALGOS_TO_ASA = 'ALGOS_TO_ASA';
export const ASA_TO_ASA = 'ASA_TO_ASA';

export class AsaswapManager {
  constructor(runtime, creator, assets, type = ALGOS_TO_ASA) {
    if (type === ALGOS_TO_ASA) {
      const program = getProgram('state.py', { type: ALGOS_TO_ASA });
      this.manager = new AlgosAsaManager(runtime, creator, assets, program);
    } else {
      const program = getProgram('state.py', { type: ASA_TO_ASA });
      this.manager = new AsaToAsaManager(runtime, creator, assets, program);
    }
  }

  setupApplication() {
    return this.manager.setupApplication();
  }

  setupEscrow() {
    return this.manager.setupEscrow();
  }

  addFundsToEscrow() {
    return this.manager.addFundsToEscrow();
  }

  deployEscrow() {
    return this.manager.deployEscrow();
  }

  escrowSetupAssets() {
    return this.manager.escrowSetupAssets();
  }

  getEscrowAddress() {
    return this.manager.getEscrowAddress();
  }

  getApplicationId() {
    return this.manager.getApplicationId();
  }

  setupApplicationWithEscrow() {
    return this.manager.setupApplicationWithEscrow();
  }

  configureEscrowAddress(escrowAddress) {
    return this.manager.configureEscrowAddress(escrowAddress);
  }

  optIn(address) {
    return this.manager.optIn(address);
  }

  addLiquidity(from, escrowAddress, primaryAssetAmount, secondaryAssetAmount, params = {}) {
    return this.manager.addLiquidity(from, escrowAddress, primaryAssetAmount, secondaryAssetAmount, params);
  }

  removeLiquidity(from, amount) {
    return this.manager.removeLiquidity(from, amount);
  }

  withdrawLiquidity(sender, amount, params={}) {
    return this.manager.withdrawLiquidity(sender, amount, params);
  }

  depositLiquidity(from, amount, params={}) {
    return this.manager.depositLiquidity(from, amount, params);
  }

  secondaryAssetSwap(from, escrowAddress, assetAmount, params={}) {
    return this.manager.secondaryAssetSwap(from, escrowAddress, assetAmount, params);
  }

  primaryAssetSwap(from, escrowAddress, assetAmount, params={}) {
    return this.manager.primaryAssetSwap(from, escrowAddress, assetAmount, params);
  }

  withdraw(sender, primaryAssetAmount, secondaryAssetAmount, params={}) {
    return this.manager.withdraw(sender, primaryAssetAmount, secondaryAssetAmount, params);
  }
}

class AlgosAsaManager {
  constructor(runtime, creator, assets, program) {
    this.creator = creator;
    this.runtime = runtime;
    this.secondaryAssetId = assets['secondaryAssetId'];
    this.liquidityAssetId = assets['liquidityAssetId'];
    this.program = program;

    this.creationArgs = [
      `int:${this.secondaryAssetId}`,
      `int:${this.liquidityAssetId}`
    ];
    this.flags = {
      sender: creator.account,
      localInts: 3,
      localBytes: 0,
      globalInts: 5,
      globalBytes: 1
    };
    this.escrow = null;
    this.applicationId = null;
    this.lSig = null;
  }

  setupApplication() {
    this.creationFlags = Object.assign({}, this.flags);
    this.applicationId = this.runtime.addApp({ ...this.creationFlags, appArgs: this.creationArgs }, {}, this.program);
  }

  setupEscrow() {
    this.deployEscrow();
    this.addFundsToEscrow();
    this.escrowSetupAssets();
  }

  addFundsToEscrow() {
    let txGroup = [
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: this.creator.account,
        toAccountAddr: this.escrow.address,
        amountMicroAlgos: this.escrow.minBalance + 302000,
        payFlags: {
          totalFee: 1000,
        }
      }
    ];
    this.runtime.executeTx(txGroup, {}, []);
  }

  deployEscrow() {
    const escrowProg = getProgram('escrow.py', { app_id: this.applicationId });
    this.lSig = this.runtime.getLogicSig(escrowProg, []);
    const escrowAddress = this.lSig.address();
    this.escrow = this.runtime.getAccount(escrowAddress);
  }

  escrowSetupAssets() {
    this.escrowOptInToSecondaryAsset();
    this.escrowOptInToLiquidityToken();
    this.configureLiquidityToken();
  }

  escrowOptInToSecondaryAsset() {
    // Opt-in to asset inside the framework
    this.runtime.optIntoASA(this.secondaryAssetId, this.escrow.address, {});
    // simulate opting in on real blockchain
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: this.creator.account,
        appId: this.applicationId,
        appArgs: [stringToBytes(SETUP_ESCROW)],
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAsset,
        assetID: this.secondaryAssetId,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: this.escrow.address,
        amount: 0,
        payFlags: {
          totalFee: 1000,
        },
      },
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }

  escrowOptInToLiquidityToken() {
    // Opt-in to asset inside the framework
    this.runtime.optIntoASA(this.liquidityAssetId, this.escrow.address, {});
    // simulate opting in on real blockchain
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: this.creator.account,
        appId: this.applicationId,
        appArgs: [stringToBytes(SETUP_ESCROW)],
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAsset,
        assetID: this.liquidityAssetId,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: this.escrow.address,
        amount: 0,
        payFlags: {
          totalFee: 1000,
        },
      },
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }

  configureLiquidityToken() {
    const assetDef = this.runtime.getAssetDef(this.liquidityAssetId);
    let tx = [
      {
        type: TransactionType.ModifyAsset,
        assetID: this.liquidityAssetId,
        sign: SignType.SecretKey,
        fromAccount: this.runtime.getAccount(assetDef.creator).account,
        fields: {
          manager: this.escrow.address,
          reserve: this.escrow.address,
          freeze: this.escrow.address,
          clawback: this.escrow.address
        },
        payFlags: {
          totalFee: 1000
        }
      }
    ];
    this.runtime.executeTx(tx);
    tx = [
      {
        type: TransactionType.TransferAsset,
        assetID: this.liquidityAssetId,
        sign: SignType.SecretKey,
        fromAccount: this.runtime.getAccount(assetDef.creator).account,
        toAccountAddr: this.escrow.address,
        amount: 10000000000,
        payFlags: {
          totalFee: 1000
        }
      }
    ];
    this.runtime.executeTx(tx);
  }

  getEscrowAddress() {
    return this.escrow.address;
  }

  getApplicationId() {
    return this.applicationId;
  }

  setupApplicationWithEscrow() {
    this.setupApplication();
    this.setupEscrow();
    this.configureEscrowAddress(this.escrow.address);
  }

  configureEscrowAddress(escrowAddress) {
    let appArgs = [stringToBytes(UPDATE)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: this.creator.account,
        appId: this.applicationId,
        appArgs: appArgs,
        accounts: [escrowAddress],
        payFlags: { totalFee: 1000 },
      }
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }

  optIn(address) {
    this.runtime.optInToApp(address, this.applicationId, {}, {}, this.program);
  }

  addLiquidity(from, escrowAddress, primaryAssetAmount, secondaryAssetAmount, params = {}) {
    let appArgs = [stringToBytes(ADD_LIQUIDITY)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['secondaryAssetId'] ? params['secondaryAssetId'] : this.secondaryAssetId,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        toAccountAddr: escrowAddress,
        amount: secondaryAssetAmount,
        payFlags: {
          totalFee: 1000,
        },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        toAccountAddr: escrowAddress,
        amountMicroAlgos: primaryAssetAmount,
        payFlags: {
          totalFee: 1000,
        },
      }
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }

  removeLiquidity(from, amount) {
    let appArgs = [stringToBytes(REMOVE_LIQUIDITY), `int:${amount}`];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      }
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }

  withdrawLiquidity(sender, liquidityAmount, params={}) {
    let appArgs = [stringToBytes(WITHDRAW_LIQUIDITY)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['assetId'] ? params['assetId'] : this.liquidityAssetId,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: sender.address,
        amount: liquidityAmount,
        payFlags: {
          totalFee: params['assetFee'] ? params['assetFee'] : 1000,
        },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        toAccountAddr: params['feeTo'] ? params['feeTo'] : this.escrow.address,
        amountMicroAlgos: 2000,
        payFlags: {
          totalFee: 1000,
        },
      }
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }

  depositLiquidity(from, liquidityAmount, params={}) {
    let appArgs = [stringToBytes(DEPOSIT_LIQUIDITY)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['assetId'] ? params['assetId'] : this.liquidityAssetId,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        toAccountAddr: this.escrow.address,
        amount: liquidityAmount,
        payFlags: {
          totalFee: 1000,
        },
      }
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }

  secondaryAssetSwap(from, escrowAddress, assetAmount, params={}) {
    let appArgs = [stringToBytes(SWAP)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['assetId'] ? params['assetId'] : this.secondaryAssetId,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        toAccountAddr: escrowAddress,
        amount: assetAmount,
        payFlags: {
          totalFee: 1000,
        },
      },
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }

  // eslint-disable-next-line no-unused-vars
  primaryAssetSwap(from, escrowAddress, primaryAssetAmount, params={}) {
    let appArgs = [stringToBytes(SWAP)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        toAccountAddr: escrowAddress,
        amountMicroAlgos: primaryAssetAmount,
        payFlags: {
          totalFee: 1000,
        },
      },
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }

  withdraw(sender, primaryAssetAmount, secondaryAssetAmount, params={}) {
    let appArgs = [stringToBytes(WITHDRAW)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: 123,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: sender.address,
        amount: secondaryAssetAmount,
        payFlags: {
          totalFee: params['primaryAssetFee'] ? params['primaryAssetFee'] : 1000,
        },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: sender.address,
        amountMicroAlgos: primaryAssetAmount,
        payFlags: {
          totalFee: params['secondaryAssetFee'] ? params['secondaryAssetFee'] : 1000,
        },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        toAccountAddr: params['feeTo'] ? params['feeTo'] : this.escrow.address,
        amountMicroAlgos: 2000,
        payFlags: {
          totalFee: 1000,
        },
      }
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }
}

class AsaToAsaManager extends AlgosAsaManager {
  constructor(runtime, creator, assets, program) {
    super(runtime, creator, assets, program);
    this.flags = {
      sender: creator.account,
      localInts: 3,
      localBytes: 0,
      globalInts: 6,
      globalBytes: 1
    };
    this.primaryAssetId = assets['primaryAssetId'];
    this.creationArgs = [
      `int:${this.secondaryAssetId}`,
      `int:${this.primaryAssetId}`,
      `int:${this.liquidityAssetId}`
    ];
  }

  addLiquidity(from, escrowAddress, primaryAssetAmount, secondaryAssetAmount, params = {}) {
    let appArgs = [stringToBytes(ADD_LIQUIDITY)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['secondaryAssetId'] ? params['secondaryAssetId'] : this.secondaryAssetId,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        toAccountAddr: escrowAddress,
        amount: secondaryAssetAmount,
        payFlags: {
          totalFee: 1000,
        },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['primaryAssetId'] ? params['primaryAssetId'] : this.primaryAssetId,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        toAccountAddr: escrowAddress,
        amount: primaryAssetAmount,
        payFlags: {
          totalFee: 1000,
        },
      }
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }

  escrowSetupAssets() {
    super.escrowSetupAssets();
    this.escrowOptInToPrimaryAsset();
  }

  escrowOptInToPrimaryAsset() {
    // Opt-in to asset inside the framework
    this.runtime.optIntoASA(this.primaryAssetId, this.escrow.address, {});
    // simulate opting in on real blockchain
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: this.creator.account,
        appId: this.applicationId,
        appArgs: [stringToBytes(SETUP_ESCROW)],
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAsset,
        assetID: this.primaryAssetId,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: this.escrow.address,
        amount: 0,
        payFlags: {
          totalFee: 1000,
        },
      },
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }

  withdraw(sender, primaryAssetAmount, secondaryAssetAmount, params={}) {
    let appArgs = [stringToBytes(WITHDRAW)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: this.secondaryAssetId,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: sender.address,
        amount: secondaryAssetAmount,
        payFlags: {
          totalFee: params['secondaryAssetFee'] ? params['secondaryAssetFee'] : 1000,
        },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: this.primaryAssetId,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: sender.address,
        amount: primaryAssetAmount,
        payFlags: {
          totalFee: params['primaryAssetFee'] ? params['primaryAssetFee'] : 1000,
        },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        toAccountAddr: params['feeTo'] ? params['feeTo'] : this.escrow.address,
        amountMicroAlgos: 2000,
        payFlags: {
          totalFee: 1000,
        },
      }
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }

  addFundsToEscrow() {
    let txGroup = [
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: this.creator.account,
        toAccountAddr: this.escrow.address,
        amountMicroAlgos: this.escrow.minBalance + 405000,
        payFlags: {
          totalFee: 1000,
        }
      }
    ];
    this.runtime.executeTx(txGroup, {}, []);
  }

  primaryAssetSwap(from, escrowAddress, primaryAssetAmount, params={}) {
    let appArgs = [stringToBytes(SWAP)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['assetId'] ? params['assetId'] : this.primaryAssetId,
        sign: SignType.SecretKey,
        fromAccount: from.account,
        toAccountAddr: escrowAddress,
        amount: primaryAssetAmount,
        payFlags: {
          totalFee: 1000,
        },
      },
    ];
    this.runtime.executeTx(txGroup, this.program, []);
  }
}
