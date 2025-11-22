/**
 * Rounds a number to 2 decimal places (cents)
 * @param {number} value - The value to round
 * @returns {number} The rounded value
 */
function roundToCents(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Calculates the fractional deviation of an asset
 * @param {number} actualPercent - Current percentage of portfolio
 * @param {number} targetPercent - Target percentage
 * @returns {number} Fractional deviation (actualPercent/targetPercent - 1)
 */
function calculateDeviation(actualPercent, targetPercent) {
  if (targetPercent === 0) return 0;
  return (actualPercent / targetPercent) - 1;
}

/**
 * Rebalances a portfolio based on a contribution or withdrawal
 * @param {number} amount - Amount to contribute (positive) or withdraw (negative)
 * @param {Array} assetClasses - Array of asset objects with properties:
 *   - name: string
 *   - targetPercent: number (0-100)
 *   - currentValue: number
 *   - sell: boolean (whether asset can be sold)
 * @returns {Object} Rebalancing results with transactions and summary
 */
export function rebalancePortfolio(amount, assetClasses) {
  // Validate inputs
  if (!Array.isArray(assetClasses) || assetClasses.length === 0) {
    throw new Error('assetClasses must be a non-empty array');
  }

  // Calculate current total value
  const totalBefore = assetClasses.reduce((sum, asset) => sum + asset.currentValue, 0);
  const totalAfter = totalBefore + amount;

  if (totalAfter < 0) {
    throw new Error('Withdrawal amount exceeds total portfolio value');
  }

  // Validate target percentages sum to 100%
  const totalTargetPercent = assetClasses.reduce((sum, asset) => sum + asset.targetPercent, 0);
  if (Math.abs(totalTargetPercent - 100) > 0.01) {
    throw new Error('Target percentages must sum to 100%');
  }

  // Initialize working values for each asset
  const assets = assetClasses.map(asset => ({
    name: asset.name,
    targetPercent: asset.targetPercent,
    currentValue: asset.currentValue,
    sell: asset.sell,
    workingValue: asset.currentValue,
    transaction: 0
  }));

  // Calculate target values after rebalancing
  assets.forEach(asset => {
    asset.targetValue = roundToCents((asset.targetPercent / 100) * totalAfter);
  });

  let remainingAmount = amount;
  const isContribution = amount > 0;
  const isWithdrawal = amount < 0;

  // For withdrawals, equalize deviations by selling from over-weighted assets
  if (isWithdrawal) {
    const sellableAssets = assets.filter(a => a.workingValue > 0);
    
    // Special case: withdrawing entire portfolio
    if (Math.abs(totalAfter) < 0.01) {
      sellableAssets.forEach(asset => {
        const adjustment = -asset.workingValue;
        asset.workingValue = 0;
        asset.transaction = adjustment;
      });
    } else {
      while (Math.abs(remainingAmount) > 0.01) {
        // Calculate current deviations for all sellable assets
        const assetDeviations = sellableAssets.map(asset => ({
          asset,
          deviation: calculateDeviation(
            (asset.workingValue / totalAfter) * 100,
            asset.targetPercent
          ),
          value: asset.workingValue
        })).filter(ad => ad.value > 0);
        
        if (assetDeviations.length === 0) break;
        
        // Sort by deviation (highest first)
        assetDeviations.sort((a, b) => b.deviation - a.deviation);
        
        const highest = assetDeviations[0];
        
        // If only one sellable asset or they're roughly equal, distribute equally
        if (assetDeviations.length === 1 || 
            (assetDeviations.length > 1 && Math.abs(highest.deviation - assetDeviations[1].deviation) < 0.0001)) {
          // Distribute remaining amount equally among assets with similar highest deviation
          const equalAssets = assetDeviations.filter(ad => 
            Math.abs(ad.deviation - highest.deviation) < 0.0001
          );
          
          const amountPerAsset = remainingAmount / equalAssets.length;
          
          for (const ad of equalAssets) {
            const maxSell = Math.min(Math.abs(amountPerAsset), ad.asset.workingValue);
            const adjustment = -roundToCents(maxSell);
            
            ad.asset.workingValue = roundToCents(ad.asset.workingValue + adjustment);
            ad.asset.transaction = roundToCents(ad.asset.transaction + adjustment);
            remainingAmount = roundToCents(remainingAmount - adjustment);
            
            if (Math.abs(remainingAmount) < 0.01) break;
          }
        } else {
          // Sell from highest to bring it down to second highest
          const secondHighest = assetDeviations[1];
          
          // Calculate amount to sell to equalize with second highest
          // We want: (value - x) / totalAfter / targetPercent - 1 = secondHighestDeviation
          // Solving: x = value - totalAfter * targetPercent * (1 + secondHighestDeviation) / 100
          const targetValue = totalAfter * (highest.asset.targetPercent / 100) * (1 + secondHighest.deviation);
          const amountToEqualize = highest.asset.workingValue - targetValue;
          
          // Sell the minimum of: amount to equalize, remaining amount, or available value
          const amountToSell = Math.min(
            Math.abs(remainingAmount),
            Math.max(0, amountToEqualize),
            highest.asset.workingValue
          );
          
          if (amountToSell < 0.01) break;
          
          const adjustment = -roundToCents(amountToSell);
          highest.asset.workingValue = roundToCents(highest.asset.workingValue + adjustment);
          highest.asset.transaction = roundToCents(highest.asset.transaction + adjustment);
          remainingAmount = roundToCents(remainingAmount - adjustment);
        }
      }
    }
  } else {
    // For contributions, use the greedy algorithm
    while (Math.abs(remainingAmount) > 0.01) {
      let selectedAsset = null;
      let bestDeviation = Infinity;

      // Find the most under-weighted asset
      for (const asset of assets) {
        const currentPercent = totalAfter > 0 ? (asset.workingValue / totalAfter) * 100 : 0;
        const deviation = calculateDeviation(currentPercent, asset.targetPercent);

        if (deviation < bestDeviation) {
          bestDeviation = deviation;
          selectedAsset = asset;
        }
      }

      if (!selectedAsset) break;

      // Buy as much as needed to reach target or use remaining amount
      const neededAmount = selectedAsset.targetValue - selectedAsset.workingValue;
      let adjustmentAmount = Math.min(remainingAmount, Math.max(0, neededAmount));
      adjustmentAmount = roundToCents(adjustmentAmount);

      // Apply the adjustment
      if (Math.abs(adjustmentAmount) > 0.01) {
        selectedAsset.workingValue = roundToCents(selectedAsset.workingValue + adjustmentAmount);
        selectedAsset.transaction = roundToCents(selectedAsset.transaction + adjustmentAmount);
        remainingAmount = roundToCents(remainingAmount - adjustmentAmount);
      } else {
        break;
      }
    }
  }

  // If there's still remaining amount (due to rounding or constraints), 
  // apply it to the most appropriate asset
  if (Math.abs(remainingAmount) > 0.01) {
    if (isContribution) {
      // Find the most under-weighted asset
      let bestAsset = assets[0];
      let bestDev = Infinity;
      for (const asset of assets) {
        const currentPercent = (asset.workingValue / totalAfter) * 100;
        const deviation = calculateDeviation(currentPercent, asset.targetPercent);
        if (deviation < bestDev) {
          bestDev = deviation;
          bestAsset = asset;
        }
      }
      bestAsset.workingValue = roundToCents(bestAsset.workingValue + remainingAmount);
      bestAsset.transaction = roundToCents(bestAsset.transaction + remainingAmount);
    } else {
      // Find the most over-weighted asset
      let bestAsset = null;
      let bestDev = -Infinity;
      for (const asset of assets) {
        if (asset.workingValue > 0) {
          const currentPercent = (asset.workingValue / totalAfter) * 100;
          const deviation = calculateDeviation(currentPercent, asset.targetPercent);
          if (deviation > bestDev) {
            bestDev = deviation;
            bestAsset = asset;
          }
        }
      }
      if (bestAsset) {
        bestAsset.workingValue = roundToCents(bestAsset.workingValue + remainingAmount);
        bestAsset.transaction = roundToCents(bestAsset.transaction + remainingAmount);
      }
    }
  }

  // Build the result object
  const transactions = assets.map(asset => {
    const currentPercent = totalBefore > 0 ? roundToCents((asset.currentValue / totalBefore) * 100) : 0;
    const finalPercent = totalAfter > 0 ? roundToCents((asset.workingValue / totalAfter) * 100) : 0;
    
    return {
      name: asset.name,
      amount: roundToCents(asset.transaction),
      currentValue: roundToCents(asset.currentValue),
      finalValue: roundToCents(asset.workingValue),
      targetPercent: roundToCents(asset.targetPercent),
      currentPercent: currentPercent,
      finalPercent: finalPercent
    };
  });

  return {
    transactions,
    summary: {
      totalBefore: roundToCents(totalBefore),
      totalAfter: roundToCents(totalAfter),
      contribution: roundToCents(amount)
    }
  };
}
