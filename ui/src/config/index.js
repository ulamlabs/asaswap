export const ALGORAND_LEDGER = 'TestNet';

export const ASSET_PAIRS = {
  'ALGOS/USDTG': {
    primaryAsset: {
      assetName: 'Algos',
      assetIndex: null,
      decimalPoints: 6,
      ratio: 10 ** 6,
    },
    secondaryAsset: {
      assetName: 'USDTG',
      assetIndex: 14075549,
      decimalPoints: 2,
      ratio: 10 ** 2,
    },
    liquidityAsset: {
      assetName: 'AU_LIQ',
      assetIndex: 14201324,
      decimalPoints: 0,
      ratio: 1
    },
    ratioDecimalPoints: 6,
    ratio: 10 ** 6,
    applicationId: 14201326,
    escrowAddress: 'PVNOJ7QGQIYXKI64TZYFOP2QM772B3C4FIUYNVO2LUZQJIO63WHA2VAGBA',
    compiledEscrow: 'AiAHAgQDBu7j4gYAASYDAVgBVwFFMgQiEkAA2jIEIxJAAFoyBCQSQAABADMAECUSMwEJMgMSEDMBIDIDEhAzABghBBIQMwAQJRIQNwAaACgSEDMBECMSEDMBEiEFDRAzAgAzAAASEDMCECEGEhAzAggzAQEPEEAAAQAhBkMzAQkyAxIzASAyAxIQMwIJMgMSEDMCIDIDEhAzABghBBIQMwAQJRIQNwAaACkSEDMBECMSEDMCECEGEjMCECMSERAzARIhBQ0zAgghBQ0RMwISIQUNERAzAwAzAAASEDMDECEGEhAzAwgzAQEzAgEIDxBAAAEAIQZDMwEJMgMSMwEgMgMSEDMAGCEEEhAzABAlEhA3ABoAKhIQMwEQIxIQMwESIQUSEEAAAQAhBkM=',
    type: 'ALGOS_TO_ASA',
    feePercentage: 3
  },
  'TOX/USDTG': {
    primaryAsset: {
      assetName: 'TOX',
      assetIndex: 14098899,
      decimalPoints: 3,
      ratio: 10 ** 3,
    },
    secondaryAsset: {
      assetName: 'USDTG',
      assetIndex: 14075549,
      decimalPoints: 2,
      ratio: 10 ** 2,
    },
    liquidityAsset: {
      assetName: 'TU_LIQ',
      assetIndex: 14201339,
      decimalPoints: 0,
      ratio: 1
    },
    ratioDecimalPoints: 6,
    ratio: 10 ** 6,
    applicationId: 14201343,
    escrowAddress: '5S3L3Q7E4C2D3BVI6ZQUW4KQ7HU7XXTPPQHMYAQXWISQUJEZL5H2ILGO64',
    compiledEscrow: 'AiAHAgQDBv/j4gYAASYDAVgBVwFFMgQiEkAA2jIEIxJAAFoyBCQSQAABADMAECUSMwEJMgMSEDMBIDIDEhAzABghBBIQMwAQJRIQNwAaACgSEDMBECMSEDMBEiEFDRAzAgAzAAASEDMCECEGEhAzAggzAQEPEEAAAQAhBkMzAQkyAxIzASAyAxIQMwIJMgMSEDMCIDIDEhAzABghBBIQMwAQJRIQNwAaACkSEDMBECMSEDMCECEGEjMCECMSERAzARIhBQ0zAgghBQ0RMwISIQUNERAzAwAzAAASEDMDECEGEhAzAwgzAQEzAgEIDxBAAAEAIQZDMwEJMgMSMwEgMgMSEDMAGCEEEhAzABAlEhA3ABoAKhIQMwEQIxIQMwESIQUSEEAAAQAhBkM=',
    type: 'ASA_TO_ASA',
    feePercentage: 3
  }
};
