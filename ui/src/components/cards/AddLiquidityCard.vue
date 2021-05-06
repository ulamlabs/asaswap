<template>
  <div>
    <WithdrawalModal v-if="hasToWithdrawLiquidity && !rawStore.pendingAction && !rawStore.pendingUpdate" />
    <Card>
      <div class="py-4 px-8 mt-3">
        <div class="flex flex-col mb-8">
          <h1 class="text-gray-700 font-semibold tracking-wide mb-2">
            Add Liquidity
          </h1>
          <p class="text-gray-500 text-base">
            Enter the amount of liquidity that you would like to add.
          </p>
        </div>
        <div class="mt-4">
          <label>Pair</label>
          <p>{{ currentPair.key }}</p>
        </div>
        <div class="mt-4">
          <NumberInput
            v-model="primaryAmount"
            :label="currentPair.primaryAsset.assetName"
            @change="onPrimaryInputChange(true)"
            @input.native="onPrimaryInputChange(false)"
          />
        </div>
        <div class="mt-4">
          <NumberInput
            v-model="secondaryAmount"
            :label="currentPair.secondaryAsset.assetName"
            @change="onSecondaryInputChange(true)"
            @input.native="onSecondaryInputChange(false)"
          />
        </div>
        <div class="py-4">
          <ActionButton
            label="Add Liquidity"
            :execute="onAddLiquidity"
            :validate="validate"
            :error="error"
          />
        </div>
      </div>
      <div
        v-if="Object.keys(globalState).length"
        class="bg-gray-100 rounded-lg"
      >
        <div class="py-4 px-4">
          <div class="flex flex-col">
            <div class="flex sm:flex-row flex-col mt-2 sm:mt-0">
              <div>Exchange rate:</div>
              <div class="sm:text-right flex-grow font-bold">
                {{ primaryPerSecondary }}
              </div>
            </div>
            <div class="flex sm:flex-row flex-col">
              <div />
              <div class="sm:text-right flex-grow font-bold">
                {{ secondaryPerPrimary }}
              </div>
            </div>
            <div class="flex sm:flex-row flex-col mt-2 sm:mt-0">
              <div>Liquidity Tokens:</div>
              <div class="sm:text-right flex-grow font-bold">
                {{ liquidityTokensDisplay }}
              </div>
            </div>
            <div class="flex sm:flex-row flex-col mt-2 sm:mt-0">
              <div>Pool Share:</div>
              <div class="sm:text-right flex-grow font-bold">
                {{ poolShareDisplay }}
              </div>
            </div>
          </div>
        </div>
        <p class="px-4 py-4">
          By adding liquidity you'll earn <strong>{{ currentPair.feePercentage }}%</strong> of all trades on this pair
          proportional to your share of the pool. Fees are added to the pool,
          accrued in real-time, and can be claimed by withdrawing your
          liquidity.
        </p>
      </div>
    </Card>
  </div>
</template>
<script>
import { mapGetters } from 'vuex';
import NumberInput from '../NumberInput';
import { getInputError } from '@/utils/validation';
import ActionButton from '../ActionButton';
import Card from '@/components/cards/Card';
import { GLOBAL_A_BAL, GLOBAL_LIQ_TOKENS, USR_LIQ_TOKENS } from '@/utils/constants';
import { ASSET_PAIRS } from '@/utils/assetPairs';
import WithdrawalModal from '@/components/modals/WithdrawalModal';

export default {
  name: 'AddLiquidityCard',
  components: {
    NumberInput,
    ActionButton,
    Card,
    WithdrawalModal
  },
  data() {
    return {
      primaryAmount: null,
      secondaryAmount: null,
      error: null,
    };
  },
  computed: {
    ...mapGetters({
      rawStore: 'algorand/rawStore',
      globalState: 'algorand/globalState',
      exchangeCalculator: 'algorand/exchangeCalculator',
      currentPair: 'algorand/currentPair',
      hasToWithdrawLiquidity: 'algorand/hasToWithdrawLiquidity'
    }),
    primaryAsset() {
      return this.currentPair.primaryAsset;
    },
    secondaryAsset() {
      return this.currentPair.secondaryAsset;
    },
    exchangeRate() {
      return Math.trunc(
        (this.primaryAsset.getRawAssetAmount(this.primaryAmount) * this.currentPair.ratio) /
          this.secondaryAsset.getRawAssetAmount(this.secondaryAmount)
      );
    },
    globalExchangeRate() {
      return this.exchangeCalculator.getGlobalExchangeRate();
    },
    reverseGlobalExchangeRate() {
      return this.exchangeCalculator.getReverseGlobalExchangeRate();
    },
    primaryPerSecondary() {
      if (!this.globalExchangeRate || !isFinite(this.globalExchangeRate)) {
        return 'N/A';
      }
      const value = this.primaryAsset.getAssetDisplayAmount(
        this.secondaryAsset.getRawAssetAmount(this.globalExchangeRate) / this.currentPair.ratio,
        this.currentPair.ratioDecimalPoints
      );
      return `${value} ${this.primaryAsset.assetName.toUpperCase()} PER ${this.secondaryAsset.assetName.toUpperCase()}`;
    },
    secondaryPerPrimary() {
      if (!this.globalExchangeRate || !isFinite(this.globalExchangeRate)) {
        return 'N/A';
      }
      const value = this.secondaryAsset.getAssetDisplayAmount(
        this.primaryAsset.getRawAssetAmount(this.reverseGlobalExchangeRate) / this.currentPair.ratio,
        this.currentPair.ratioDecimalPoints
      );
      return `${value} ${this.secondaryAsset.assetName.toUpperCase()} PER ${this.primaryAsset.assetName.toUpperCase()}`;
    },
    difference() {
      return Math.trunc(
        (Math.abs(this.exchangeRate - this.globalExchangeRate) * this.currentPair.ratio) /
        this.globalExchangeRate
      ) / this.currentPair.ratio;
    },
    isDifferenceCorrect() {
      if (isNaN(this.difference)) {
        return false;
      }
      return this.difference < 0.01;
    },
    liquidityTokens() {
      if (!this.globalState) {
        return;
      }
      if (this.globalState[GLOBAL_LIQ_TOKENS] === 0) {
        return this.primaryAsset.getRawAssetAmount(this.primaryAmount);
      }
      return Math.trunc(
        (this.primaryAsset.getRawAssetAmount(this.primaryAmount) * this.globalState[GLOBAL_LIQ_TOKENS]) /
          this.globalState[GLOBAL_A_BAL]
      );
    },
    liquidityTokensDisplay() {
      if (!this.liquidityTokens) {
        return 0;
      }
      return this.liquidityTokens;
    },
    poolShareDisplay() {
      if (this.liquidityTokens && this.globalState[GLOBAL_LIQ_TOKENS] === 0) {
        return '100%';
      } else if (!this.globalState[GLOBAL_LIQ_TOKENS]) {
        return '0%';
      }
      const value = (this.liquidityTokens * 100 / (this.globalState[GLOBAL_LIQ_TOKENS] + this.liquidityTokens)).toFixed(2);
      if (value >= 100) {
        return '99.99%';
      }
      return value + '%';
    }
  },
  watch: {
    currentPair() {
      this.primaryAmount = null;
      this.secondaryAmount = null;
      this.validate();
    }
  },
  created() {
    const pairKey = this.decodePair(this.$route.params.pair);
    if (!ASSET_PAIRS[pairKey]) {
      this.$router.push('/pool');
    }
    this.$store.dispatch('algorand/SET_CURRENT_PAIR', { pairKey });
  },
  methods: {
    decodePair(pairName) {
      return decodeURIComponent(pairName).toUpperCase().replace('-', '/');
    },
    onPrimaryInputChange(recalculate) {
      if (!this.globalState[GLOBAL_LIQ_TOKENS]) {
        this.validate();
        return;
      }
      if (this.primaryAmount === null || this.primaryAmount === '') {
        this.secondaryAmount = null;
        return;
      }
      this.secondaryAmount = this.secondaryAsset.getAssetDisplayAmount(
        Math.trunc(
          (this.primaryAsset.getRawAssetAmount(this.primaryAmount) / this.globalExchangeRate) * this.currentPair.ratio
        )
      );
      if (!this.isDifferenceCorrect && recalculate) {
        this.primaryAmount = this.primaryAsset.getAssetDisplayAmount(
          Math.trunc(
            (this.globalExchangeRate * this.secondaryAsset.getRawAssetAmount(this.secondaryAmount)) /
              this.currentPair.ratio
          )
        );
      }
      this.validate();
    },
    onSecondaryInputChange(recalculate) {
      if (!this.globalState[GLOBAL_LIQ_TOKENS]) {
        this.validate();
        return;
      }
      if (this.secondaryAmount === null || this.secondaryAmount === '') {
        this.primaryAmount = null;
        return;
      }
      this.primaryAmount = this.primaryAsset.getAssetDisplayAmount(
        Math.trunc(
          (this.globalExchangeRate * this.secondaryAsset.getRawAssetAmount(this.secondaryAmount)) /
            this.currentPair.ratio
        )
      );
      if (!this.isDifferenceCorrect && recalculate) {
        this.assetAmount = this.secondaryAsset.getAssetDisplayAmount(
          Math.trunc(
            (this.primaryAsset.getRawAssetAmount(this.primaryAmount) / this.globalExchangeRate) * this.currentPair.ratio
          )
        );
      }
      this.validate();
    },
    validate() {
      let error = null;
      error = getInputError(this.secondaryAmount, this.secondaryAsset.decimalPoints, this.secondaryAsset.assetName);
      error =
        error ||
        getInputError(this.primaryAmount, this.primaryAsset.decimalPoints, this.primaryAsset.assetName);
      if (
        !error &&
        !this.isDifferenceCorrect &&
        this.globalState[GLOBAL_LIQ_TOKENS] > 0
      ) {
        error = 'Invalid exchange rate';
      }
      this.error = error;
      this.$forceUpdate();
      return !error;
    },
    async onAddLiquidity() {
      const accountAddress = this.rawStore.account;
      await this.$store.dispatch('algorand/QUEUE_ASSET_OPT_IN', {
        assetIds: [this.currentPair.liquidityAsset.assetIndex]
      });
      const primaryAmount = this.primaryAsset.getRawAssetAmount(this.primaryAmount);
      const secondaryAmount = this.secondaryAsset.getRawAssetAmount(this.secondaryAmount);
      await this.$store.dispatch('algorand/QUEUE_ACTION', {
        actionMethod: async () => {
          await this.rawStore.serviceInstance.addLiquidity(accountAddress, primaryAmount, secondaryAmount);
        },
        actionMessage: 'Adding liquidity...',
        actionVerificationMethod: ({ prevState, newState }) => {
          return Number(prevState[USR_LIQ_TOKENS]) !== Number(newState[USR_LIQ_TOKENS]);
        }
      });
      const currentPairAppIndex = this.currentPair.applicationId;
      await this.$store.dispatch('algorand/QUEUE_ACTION', {
        actionMethod: async () => {
          await this.$store.dispatch('algorand/FETCH_APPLICATION_DATA', { appId: currentPairAppIndex });
        },
        backgroundAction: true
      });
      await this.$store.dispatch('algorand/QUEUE_ACTION', {
        actionMethod: async () => {
          await this.$store.dispatch('algorand/WITHDRAW');
        },
        actionMessage: 'Withdrawing...'
      });
      this.primaryAmount = null;
      this.secondaryAmount = null;
    },
  },
};
</script>
