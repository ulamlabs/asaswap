/* globals describe, it */

import chai from 'chai';
import random from 'random-bigint';
import { ALGOS_TO_ASA, ASA_TO_ASA, AsaswapManager } from './utils/asaswap.mjs';
import { configureTest } from './base.mjs';
import { fundAccounts, setupAssets, ASSET_TOTAL } from './utils/assets.mjs';
import { Runtime, StoreAccount } from '@algo-builder/runtime';
import { USR_A_BAL, USR_B_BAL, USR_LIQ_TOKENS, TRADE_MAX, GLOBAL_A_BAL, GLOBAL_B_BAL } from '../common/constants.js';

const { assert } = chai;

const MASTER_ALGOS = 1e8; // initial amount of microAlgos for master

[ASA_TO_ASA, ALGOS_TO_ASA].forEach(function (contractType) {
  describe(`${contractType} Precision Tests`, function () {
    configureTest.call(this, contractType);

    this.beforeEach(() => {
      this.master = new StoreAccount(MASTER_ALGOS);
      this.creator = new StoreAccount(this.minBalance);
      this.swapper = new StoreAccount(ASSET_TOTAL); // needed for large swaps test
      this.runtime = new Runtime([this.master, this.creator, this.swapper]);
      this.assetIds = setupAssets(this.runtime, this.master);
      this.runtime.optIntoASA(this.assetIds.primaryAssetId, this.master.address, {});
      this.runtime.optIntoASA(this.assetIds.secondaryAssetId, this.master.address, {});
      this.runtime.optIntoASA(this.assetIds.liquidityAssetId, this.swapper.address, {});
      fundAccounts( // this will opt-in swapper to assets
        this.runtime, 
        this.master, 
        [this.swapper], 
        [this.assetIds.primaryAssetId, this.assetIds.secondaryAssetId],
        ASSET_TOTAL // Transfer all tokens to swapper
      );
      this.asaswap = new AsaswapManager(this.runtime, this.creator, this.assetIds, contractType);
      this.asaswap.setupApplicationWithEscrow(this.master);
      this.asaswap.optIn(this.swapper.address);
    });

    it('add little liquidity', () => {
      const LIQ_AMT = 2**31; // liquidity to be provided to contract
      this.asaswap.addLiquidity(this.swapper, this.asaswap.getEscrowAddress(), LIQ_AMT, LIQ_AMT);

      const LIQ_AMT2 = LIQ_AMT - 1; // add more liquidity but don't exceed uint32 limit (2**32-1)
      this.asaswap.addLiquidity(this.swapper, this.asaswap.getEscrowAddress(), LIQ_AMT2, LIQ_AMT2);
      this.asaswap.withdrawLiquidity(this.swapper, LIQ_AMT + LIQ_AMT2);
      assert.equal(
        this.runtime.getAssetHolding(this.assetIds.liquidityAssetId, this.swapper.address).amount, 
        BigInt(LIQ_AMT + LIQ_AMT2)
      );
    });

    it('overflow when adding huge amount of liquidity', () => {
      this.asaswap.addLiquidity(this.swapper, this.asaswap.getEscrowAddress(), TRADE_MAX, TRADE_MAX/2n);
      this.asaswap.removeLiquidity(this.swapper, TRADE_MAX);
      this.asaswap.withdraw(this.swapper, this.getLocalNumber(this.swapper.address, USR_A_BAL), this.getLocalNumber(this.swapper.address, USR_B_BAL));

      this.asaswap.addLiquidity(this.swapper, this.asaswap.getEscrowAddress(), TRADE_MAX/2n, TRADE_MAX);
      this.asaswap.removeLiquidity(this.swapper, TRADE_MAX/2n);
      this.asaswap.withdraw(this.swapper, this.getLocalNumber(this.swapper.address, USR_A_BAL), this.getLocalNumber(this.swapper.address, USR_B_BAL));
    });

    it('precision when adding huge amount of liquidity', () => {
      let PT = random(96) % TRADE_MAX;
      let A = random(96) % TRADE_MAX;
      let a = random(96) % TRADE_MAX;
      this.asaswap.addLiquidity(this.swapper, this.asaswap.getEscrowAddress(), PT, PT);
      let PTissued = this.getLocalNumber(this.swapper.address, USR_LIQ_TOKENS);
      this.asaswap.withdrawLiquidity(this.swapper, this.getLocalNumber(this.swapper.address, USR_LIQ_TOKENS));
      // swap tokens so that the first token amount is close to A
      let delta = PT - A;
      let swap_amt = (PT*delta) / (PT-delta); // calculated, so that ratio is conserved (token_a * token_b = const)
      if (delta > 0) {
        this.asaswap.secondaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), swap_amt);
      } else if (delta < 0) {
        this.asaswap.primaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), -swap_amt);
      }
      this.asaswap.withdraw(this.swapper, this.getLocalNumber(this.swapper.address, USR_A_BAL), this.getLocalNumber(this.swapper.address, USR_B_BAL));
      A = this.getGlobalNumber(GLOBAL_A_BAL); // overwrite with actual A amount
      let B = this.getGlobalNumber(GLOBAL_B_BAL);
      this.asaswap.addLiquidity(this.swapper, this.asaswap.getEscrowAddress(), a, a*B/A);
      let receivedPT = this.getLocalNumber(this.swapper.address, USR_LIQ_TOKENS);
      assert(receivedPT * this.getGlobalNumber(GLOBAL_A_BAL) <= a * PTissued, 'User received too many liquidity tokens');
      assert((receivedPT + 1) * this.getGlobalNumber(GLOBAL_A_BAL) > a * PTissued, 'User could receive more tokens, but didn\'t');
    });

    it('overflow in primary swap transactions', () => {
      this.asaswap.addLiquidity(this.swapper, this.asaswap.getEscrowAddress(), TRADE_MAX/2n, TRADE_MAX/5n);
      this.asaswap.primaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), TRADE_MAX);
      this.asaswap.withdraw(this.swapper, this.getLocalNumber(this.swapper.address, USR_A_BAL), this.getLocalNumber(this.swapper.address, USR_B_BAL));
    });

    it('precision in primary swap transactions', () => {
      this.asaswap.addLiquidity(this.swapper, this.asaswap.getEscrowAddress(), TRADE_MAX/10000n, 3);
      this.asaswap.primaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), TRADE_MAX/10000n);
      assert.notEqual(this.getLocalNumber(this.swapper.address, USR_B_BAL), 0);
      this.asaswap.withdraw(this.swapper, this.getLocalNumber(this.swapper.address, USR_A_BAL), this.getLocalNumber(this.swapper.address, USR_B_BAL));
    });

    it('precision in secondary swap transactions', () => {
      this.asaswap.addLiquidity(this.swapper, this.asaswap.getEscrowAddress(), 3, TRADE_MAX/10000n);
      this.asaswap.secondaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), TRADE_MAX/10000n);
      assert.notEqual(this.getLocalNumber(this.swapper.address, USR_A_BAL), 0);
      this.asaswap.withdraw(this.swapper, this.getLocalNumber(this.swapper.address, USR_A_BAL), this.getLocalNumber(this.swapper.address, USR_B_BAL));
    });
  });
});
