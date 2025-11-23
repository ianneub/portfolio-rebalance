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
 * Calculates the minimum contribution needed to perfectly balance a portfolio
 * @param {Array} assetClasses - Array of asset objects with properties:
 *   - name: string
 *   - targetPercent: number (0-100)
 *   - currentValue: number
 *   - sell: boolean (whether asset can be sold)
 * @returns {number} The contribution amount needed to balance the portfolio
 */
export function calculateBalancingContribution(assetClasses) {
  // Validate inputs
  if (!Array.isArray(assetClasses) || assetClasses.length === 0) {
    throw new Error('assetClasses must be a non-empty array');
  }

  // Validate target percentages sum to 100%
  const totalTargetPercent = assetClasses.reduce((sum, asset) => sum + asset.targetPercent, 0);
  if (Math.abs(totalTargetPercent - 100) > 0.01) {
    throw new Error('Target percentages must sum to 100%');
  }

  // Calculate current total value
  const totalBefore = assetClasses.reduce((sum, asset) => sum + asset.currentValue, 0);

  // Calculate the minimum contribution needed to perfectly balance the portfolio
  // For each asset, we need: finalValue = (targetPercent/100) * totalAfter
  // Where: finalValue = currentValue + contribution_to_asset
  // And: totalAfter = totalBefore + total_contribution
  // 
  // For perfect balance: currentValue / totalAfter = targetPercent / 100
  // Solving: totalAfter = currentValue * 100 / targetPercent
  // Therefore: contribution = totalAfter - totalBefore
  //
  // The minimum contribution is determined by the most over-weighted asset
  let minContribution = 0;
  for (const asset of assetClasses) {
    if (asset.targetPercent > 0) {
      const requiredTotal = (asset.currentValue * 100) / asset.targetPercent;
      const contribution = requiredTotal - totalBefore;
      minContribution = Math.max(minContribution, contribution);
    }
  }

  return roundToCents(minContribution);
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
  const allAssetsSellable = sellableAssets.length === assets.length;
  const hasInternalRebalancing = sellableAssets.length > 0;

  // Do internal rebalancing only when:
  // 1. Not withdrawing (amount >= 0), OR
  // 2. Withdrawing but all assets are sellable
  const shouldDoInternalRebalancing = hasInternalRebalancing && totalAfter > 0.01 && (amount >= 0 || allAssetsSellable);

  if (shouldDoInternalRebalancing) {
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
    // Special case: withdrawing entire portfolio
    if (Math.abs(totalAfter) < 0.01) {
      assets.filter(a => a.workingValue > 0).forEach(asset => {
        const adjustment = -asset.workingValue;
        asset.workingValue = 0;
        asset.transaction = adjustment;
      });
    } else {
      // For withdrawals, prioritize achieving perfect balance across all assets
      // Strategy: Always try to achieve perfect balance after withdrawal first

      // Calculate what perfect balance would look like after withdrawal
      const canAchievePerfectBalance = assets.every(asset => {
        const targetFinalValue = (asset.targetPercent / 100) * totalAfter;
        // Can achieve if target is less than or equal to current (we're withdrawing)
        return targetFinalValue <= asset.workingValue + 0.01; // small tolerance
      });

      if (canAchievePerfectBalance) {
        // Withdraw in a way that achieves perfect target allocation (regardless of sell attribute)
        const totalTargetPercent = assets.reduce((sum, a) => sum + a.targetPercent, 0);

        for (const asset of assets) {
          const targetFinalValue = (asset.targetPercent / totalTargetPercent) * totalAfter;
          const adjustment = roundToCents(targetFinalValue - asset.workingValue);

          asset.workingValue = roundToCents(asset.workingValue + adjustment);
          asset.transaction = roundToCents(asset.transaction + adjustment);
          remainingAmount = roundToCents(remainingAmount - adjustment);
        }
      } else {
        // Cannot achieve perfect balance - use sellable asset preference logic
        const sellableAssets = assets.filter(a => a.sell === true);

        if (sellableAssets.length > 0) {
          // We have some sellable assets, try to withdraw from them first
          const sellableValue = sellableAssets.reduce((sum, a) => sum + a.workingValue, 0);

          if (Math.abs(amount) <= sellableValue) {
            // We can satisfy the withdrawal from sellable assets only
            const totalSellableTargetPercent = sellableAssets.reduce((sum, a) => sum + a.targetPercent, 0);

            for (const asset of sellableAssets) {
              if (asset.workingValue > 0.01) {
                // Calculate how much to withdraw to maintain target ratios among sellable assets
                const sellableAfterTotal = sellableValue + amount; // amount is negative
                const targetFinalValue = (asset.targetPercent / totalSellableTargetPercent) * sellableAfterTotal;
                const adjustment = roundToCents(targetFinalValue - asset.workingValue);

                asset.workingValue = roundToCents(asset.workingValue + adjustment);
                asset.transaction = roundToCents(asset.transaction + adjustment);
                remainingAmount = roundToCents(remainingAmount - adjustment);
              }
            }
          } else {
            // Need to withdraw from all assets
            const totalTargetPercent = assets.reduce((sum, a) => sum + a.targetPercent, 0);

            for (const asset of assets) {
              if (asset.workingValue > 0.01) {
                const targetFinalValue = (asset.targetPercent / totalTargetPercent) * totalAfter;
                const adjustment = roundToCents(targetFinalValue - asset.workingValue);

                asset.workingValue = roundToCents(asset.workingValue + adjustment);
                asset.transaction = roundToCents(asset.transaction + adjustment);
                remainingAmount = roundToCents(remainingAmount - adjustment);
              }
            }
          }
        } else {
          // No sellable assets - withdraw from overweighted assets only
          // First, identify which assets are overweighted
          const currentPercentages = assets.map(asset => ({
            asset,
            currentPercent: (asset.workingValue / totalBefore) * 100
          }));

          const overweightedAssets = currentPercentages
            .filter(ap => ap.currentPercent > ap.asset.targetPercent && ap.asset.workingValue > 0.01)
            .map(ap => ap.asset);

          if (overweightedAssets.length > 0) {
            // Withdraw from overweighted assets to move them towards their target ratios
            // Calculate the total target percentage for overweighted assets
            const totalOverweightedTargetPercent = overweightedAssets.reduce((sum, a) => sum + a.targetPercent, 0);
            const totalOverweightedValue = overweightedAssets.reduce((sum, a) => sum + a.workingValue, 0);

            // Calculate the new total value after withdrawal for overweighted assets
            const overweightedAfterTotal = totalOverweightedValue + amount; // amount is negative

            for (const asset of overweightedAssets) {
              // Calculate target final value proportional to their target percentages
              const targetFinalValue = (asset.targetPercent / totalOverweightedTargetPercent) * overweightedAfterTotal;
              const adjustment = roundToCents(targetFinalValue - asset.workingValue);

              asset.workingValue = roundToCents(asset.workingValue + adjustment);
              asset.transaction = roundToCents(asset.transaction + adjustment);
              remainingAmount = roundToCents(remainingAmount - adjustment);
            }
          } else {
            // No overweighted assets, withdraw from all assets proportionally to target
            const totalTargetPercent = assets.reduce((sum, a) => sum + a.targetPercent, 0);

            for (const asset of assets) {
              if (asset.workingValue > 0.01) {
                const targetFinalValue = (asset.targetPercent / totalTargetPercent) * totalAfter;
                const adjustment = roundToCents(targetFinalValue - asset.workingValue);

                asset.workingValue = roundToCents(asset.workingValue + adjustment);
                asset.transaction = roundToCents(asset.transaction + adjustment);
                remainingAmount = roundToCents(remainingAmount - adjustment);
              }
            }
          }
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
