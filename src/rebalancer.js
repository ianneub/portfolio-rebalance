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

  // NEW: Handle internal rebalancing when sell=true is set
  // Sell from over-weighted assets (where sell=true) to buy under-weighted assets
  
  // First, check if internal rebalancing is needed
  const sellableAssets = assets.filter(a => a.sell === true);
  const hasInternalRebalancing = sellableAssets.length > 0;
  
  // Do internal rebalancing for any amount (including withdrawals) when assets are sellable
  if (hasInternalRebalancing && totalAfter > 0.01) {
    // Calculate target values and deviations for all assets
    assets.forEach(asset => {
      const currentPercent = (asset.workingValue / totalAfter) * 100;
      asset.deviation = calculateDeviation(currentPercent, asset.targetPercent);
    });
    
    // Iteratively rebalance: sell from over-weighted sellable assets, buy under-weighted
    let maxIterations = 1000; // Prevent infinite loops
    let iteration = 0;
    
    while (iteration < maxIterations) {
      iteration++;
      
      // Recalculate deviations based on current working values
      assets.forEach(asset => {
        const currentPercent = (asset.workingValue / totalAfter) * 100;
        asset.deviation = calculateDeviation(currentPercent, asset.targetPercent);
      });
      
      // Find most over-weighted sellable asset (deviation > 0, sell=true, value > 0)
      const overWeighted = assets
        .filter(a => a.sell === true && a.workingValue > 0.01 && a.deviation > 0.0001)
        .sort((a, b) => b.deviation - a.deviation);
      
      // Find most under-weighted asset that is also sellable (deviation < 0, sell=true)
      // For internal rebalancing, only transfer between sellable assets
      const underWeighted = assets
        .filter(a => a.sell === true && a.deviation < -0.0001)
        .sort((a, b) => a.deviation - b.deviation);
      
      // If no valid pairs, we're done with internal rebalancing
      if (overWeighted.length === 0 || underWeighted.length === 0) {
        break;
      }
      
      const seller = overWeighted[0];
      const buyer = underWeighted[0];
      
      // Calculate how much we can/should transfer
      // We want to move funds until either:
      // 1. Seller reaches target (deviation = 0)
      // 2. Buyer reaches target (deviation = 0)
      // 3. Seller reaches 0 value
      
      const sellerTarget = (seller.targetPercent / 100) * totalAfter;
      const buyerTarget = (buyer.targetPercent / 100) * totalAfter;
      
      const sellerExcess = seller.workingValue - sellerTarget;
      const buyerDeficit = buyerTarget - buyer.workingValue;
      
      // Transfer the minimum of: seller's excess, buyer's deficit, seller's total value
      const transferAmount = Math.min(
        Math.max(0, sellerExcess),
        Math.max(0, buyerDeficit),
        seller.workingValue
      );
      
      if (transferAmount < 0.01) {
        break; // Nothing meaningful to transfer
      }
      
      // Execute the internal transfer
      const roundedTransfer = roundToCents(transferAmount);
      seller.workingValue = roundToCents(seller.workingValue - roundedTransfer);
      seller.transaction = roundToCents(seller.transaction - roundedTransfer);
      buyer.workingValue = roundToCents(buyer.workingValue + roundedTransfer);
      buyer.transaction = roundToCents(buyer.transaction + roundedTransfer);
    }
  }
  
  // After internal rebalancing, handle any external contribution or withdrawal
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
    const currentPercent = totalBefore > 0 ? Math.round((asset.currentValue / totalBefore) * 100 * 100) / 100 : 0;
    const finalPercent = totalAfter > 0 ? Math.round((asset.workingValue / totalAfter) * 100 * 100) / 100 : 0;
    
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
