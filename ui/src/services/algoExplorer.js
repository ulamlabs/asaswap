import { emitError } from '@/utils/errors';

export class AlgoExplorer {
  constructor(ledger) {
    if (ledger.toUpperCase() === 'TESTNET') {
      this.url = 'https://api.testnet.algoexplorer.io';
    } else if (ledger.toUpperCase() == 'BETANET') {
      this.url = 'https://api.betanet.algoexplorer.io';
    } else {
      this.url = 'https://api.algoexplorer.io';
    }
  }

  async fetch(path) {
    try {
      const response = await fetch(`${this.url}${path}`);
      const data = await response.json();
      return data;
    } catch (e) {
      emitError('Could not fetch information from the Algorand blockchain');
      throw e;
    }
  }
}
