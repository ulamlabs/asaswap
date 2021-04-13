/* globals describe, it */

import chai from 'chai';
import { ALGOS_TO_ASA, ASA_TO_ASA } from './utils/asaswap.mjs';
import constants from '../common/constants.js';
import { configureTest } from './base.mjs';

const {
  USR_A_BAL,
  USR_B_BAL,
  GLOBAL_A_BAL,
  GLOBAL_B_BAL
} = constants;
const { assert } = chai;

[ASA_TO_ASA, ALGOS_TO_ASA].forEach(function (contractType) {
  describe(`${contractType} Swap Tests`, function () {
    configureTest.call(this, contractType);

    this.getExchangeConstant = function() { // Constant function constant
      return BigInt(this.getGlobalNumber(GLOBAL_A_BAL)) * BigInt(this.getGlobalNumber(GLOBAL_B_BAL));
    };

    it('swap preserves constant function', () => {
      this.asaswap.setupApplicationWithEscrow(this.master);
      this.asaswap.optIn(this.master.address);
      this.asaswap.optIn(this.swapper.address);
      let A = 1337n, B = 2137n;
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), A, B);
      let K = this.getExchangeConstant();

      this.asaswap.secondaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), 1409);
      this.asaswap.withdraw(this.swapper, this.getLocalNumber(this.swapper.address, USR_A_BAL), this.getLocalNumber(this.swapper.address, USR_B_BAL));
      let curK = this.getExchangeConstant();
      assert(curK >= K, `CFMM must preserve A * B >= K (K cannot decrease). Initially K was ${K}, currently is ${curK}`);

      this.asaswap.primaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), 2027);
      this.asaswap.withdraw(this.swapper, this.getLocalNumber(this.swapper.address, USR_A_BAL), this.getLocalNumber(this.swapper.address, USR_B_BAL));
      curK = this.getExchangeConstant();
      assert(curK >= K, `CFMM must preserve A * B >= K (K cannot decrease). Initially K was ${K}, currently is ${curK}`);
    });

    it('large swap preserves constant function', () => {
      this.asaswap.setupApplicationWithEscrow(this.master);
      this.asaswap.optIn(this.master.address);
      this.asaswap.optIn(this.swapper.address);
      let A = 176590594953881n, B = 277620723682493n; // 48 bit primes
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), A, B);
      let K = this.getExchangeConstant();

      this.asaswap.secondaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), 983920151771n);
      this.asaswap.withdraw(this.swapper, this.getLocalNumber(this.swapper.address, USR_A_BAL), this.getLocalNumber(this.swapper.address, USR_B_BAL));
      let curK = this.getExchangeConstant();
      assert(curK >= K, `CFMM must preserve A * B >= K (K cannot decrease). Initially K was ${K}, currently is ${curK}`);

      this.asaswap.primaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), B - A);
      this.asaswap.withdraw(this.swapper, this.getLocalNumber(this.swapper.address, USR_A_BAL), this.getLocalNumber(this.swapper.address, USR_B_BAL));
      curK = this.getExchangeConstant();
      assert(curK >= K, `CFMM must preserve A * B >= K (K cannot decrease). Initially K was ${K}, currently is ${curK}`);
    });

  });
});
