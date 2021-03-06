import { Runtime, StoreAccount } from '@algo-builder/runtime';
import { fundAccounts, setupAssets } from './utils/assets.mjs';
import { AsaswapManager } from './utils/asaswap.mjs';

export function configureTest(contractType) {
  this.minBalance = 1e7; // 10 Algos

  this.getGlobal = (key) => this.runtime.getGlobalState(this.asaswap.getApplicationId(), key);

  this.getGlobalNumber = (key) => this.runtime.getGlobalState(this.asaswap.getApplicationId(), key);
  this.getLocalNumber = (accountAddr, key) => this.runtime.getLocalState(this.asaswap.getApplicationId(), accountAddr, key);

  this.beforeEach(() => {
    this.master = new StoreAccount(1e17);
    this.creator = new StoreAccount(this.minBalance);
    this.swapper = new StoreAccount(this.minBalance);
    this.runtime = new Runtime([this.master, this.creator, this.swapper]);
    this.assetIds = setupAssets(this.runtime, this.master);
    fundAccounts(this.runtime, this.master, [this.master, this.creator, this.swapper], this.assetIds);
    this.asaswap = new AsaswapManager(this.runtime, this.creator, this.assetIds, contractType);
  });
}
