import { rebalancePortfolio } from '../src/rebalancer.js';

describe('Portfolio Rebalancer', () => {
  // Base portfolio for testing
  const basePortfolio = [
    { name: 'Stocks', targetPercent: 80, currentValue: 100000, sell: false },
    { name: 'Cash', targetPercent: 10, currentValue: 40000, sell: false },
    { name: 'Bonds', targetPercent: 10, currentValue: 50000, sell: false }
  ];

  describe('Basic rebalancing with contributions', () => {
    test('Adding $25,000 should put all money into Stocks', () => {
      const result = rebalancePortfolio(25000, basePortfolio);

      expect(result.summary.totalBefore).toBe(190000);
      expect(result.summary.totalAfter).toBe(215000);
      expect(result.summary.contribution).toBe(25000);

      // Find each asset transaction
      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');
      const bonds = result.transactions.find(t => t.name === 'Bonds');

      expect(stocks.amount).toBe(25000);
      expect(cash.amount).toBe(0);
      expect(bonds.amount).toBe(0);

      expect(stocks.finalValue).toBe(125000);
      expect(cash.finalValue).toBe(40000);
      expect(bonds.finalValue).toBe(50000);

      // Verify sum of transactions equals contribution
      const totalTransaction = stocks.amount + cash.amount + bonds.amount;
      expect(totalTransaction).toBe(25000);
    });

    test('Adding $325,000 should allocate $312,000 to Stocks, $11,500 to Cash, $1,500 to Bonds', () => {
      const result = rebalancePortfolio(325000, basePortfolio);

      expect(result.summary.totalBefore).toBe(190000);
      expect(result.summary.totalAfter).toBe(515000);
      expect(result.summary.contribution).toBe(325000);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');
      const bonds = result.transactions.find(t => t.name === 'Bonds');

      expect(stocks.amount).toBe(312000);
      expect(cash.amount).toBe(11500);
      expect(bonds.amount).toBe(1500);

      expect(stocks.finalValue).toBe(412000);
      expect(cash.finalValue).toBe(51500);
      expect(bonds.finalValue).toBe(51500);

      // Verify sum of transactions equals contribution
      const totalTransaction = stocks.amount + cash.amount + bonds.amount;
      expect(totalTransaction).toBe(325000);
    });
  });

  describe('Rebalancing with sell property modifications', () => {
    test('Rebalancing with all assets sellable: purchase 52K stocks, sell 21K cash, sell 31K bonds', () => {
      // Use base portfolio but make all assets sellable
      const sellablePortfolio = basePortfolio.map(asset => ({
        ...asset,
        sell: true
      }));

      const result = rebalancePortfolio(0, sellablePortfolio);

      expect(result.summary.totalBefore).toBe(190000);
      expect(result.summary.totalAfter).toBe(190000);
      expect(result.summary.contribution).toBe(0);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');
      const bonds = result.transactions.find(t => t.name === 'Bonds');

      // Expected transactions to balance portfolio
      expect(stocks.amount).toBe(52000);  // Purchase 52,000 stocks
      expect(cash.amount).toBe(-21000);   // Sell 21,000 cash
      expect(bonds.amount).toBe(-31000);  // Sell 31,000 bonds

      // Verify final values
      expect(stocks.finalValue).toBe(152000);  // 100,000 + 52,000
      expect(cash.finalValue).toBe(19000);     // 40,000 - 21,000
      expect(bonds.finalValue).toBe(19000);    // 50,000 - 31,000

      // Verify final percentages match targets
      expect(stocks.finalPercent).toBe(80);    // 152,000 / 190,000 = 80%
      expect(cash.finalPercent).toBe(10);      // 19,000 / 190,000 = 10%
      expect(bonds.finalPercent).toBe(10);     // 19,000 / 190,000 = 10%

      // Verify sum of transactions equals contribution (should be 0)
      const totalTransaction = stocks.amount + cash.amount + bonds.amount;
      expect(totalTransaction).toBe(0);
    });

    test('Rebalancing with only stocks sellable should result in no transactions', () => {
      // Use base portfolio but only make stocks sellable
      const limitedSellPortfolio = basePortfolio.map(asset => ({
        ...asset,
        sell: asset.name === 'Stocks' ? true : false
      }));

      const result = rebalancePortfolio(0, limitedSellPortfolio);

      expect(result.summary.totalBefore).toBe(190000);
      expect(result.summary.totalAfter).toBe(190000);
      expect(result.summary.contribution).toBe(0);

      // All transactions should be 0 since only stocks can be sold but stocks are already underweighted
      result.transactions.forEach(t => {
        expect(t.amount).toBe(0);
        expect(t.finalValue).toBe(t.currentValue);
      });

      // Verify no rebalancing occurred - portfolio remains unchanged
      expect(result.transactions.find(t => t.name === 'Stocks').finalPercent).toBe(Math.round((100000 / 190000) * 100 * 100) / 100);
      expect(result.transactions.find(t => t.name === 'Cash').finalPercent).toBe(Math.round((40000 / 190000) * 100 * 100) / 100);
      expect(result.transactions.find(t => t.name === 'Bonds').finalPercent).toBe(Math.round((50000 / 190000) * 100 * 100) / 100);
    });

    test('Rebalancing with only stocks and cash sellable: sell 21K cash, purchase 21K stocks', () => {
      // Use base portfolio but set stocks and cash to sell: true
      const portfolio = [
        { name: 'Stocks', targetPercent: 80, currentValue: 100000, sell: true },
        { name: 'Cash', targetPercent: 10, currentValue: 40000, sell: true },
        { name: 'Bonds', targetPercent: 10, currentValue: 50000, sell: false }
      ];

      const result = rebalancePortfolio(0, portfolio);

      expect(result.summary.totalBefore).toBe(190000);
      expect(result.summary.totalAfter).toBe(190000);
      expect(result.summary.contribution).toBe(0);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');
      const bonds = result.transactions.find(t => t.name === 'Bonds');

      // Expected transactions: sell cash to buy stocks (bonds stays unchanged)
      expect(stocks.amount).toBe(21000);   // Purchase 21,000 stocks
      expect(cash.amount).toBe(-21000);    // Sell 21,000 cash
      expect(bonds.amount).toBe(0);        // No change to bonds (cannot sell)

      // Verify final values
      expect(stocks.finalValue).toBe(121000);  // 100,000 + 21,000
      expect(cash.finalValue).toBe(19000);     // 40,000 - 21,000
      expect(bonds.finalValue).toBe(50000);    // 50,000 (unchanged)

      // Verify sum of transactions equals contribution (should be 0)
      const totalTransaction = stocks.amount + cash.amount + bonds.amount;
      expect(totalTransaction).toBe(0);
    });

    test('Adding $10,000 with all assets sellable: purchase 60K stocks, sell 20K cash, sell 30K bonds', () => {
      // Use base portfolio but make all assets sellable
      const portfolio = basePortfolio.map(asset => ({
        ...asset,
        sell: true
      }));

      const result = rebalancePortfolio(10000, portfolio);

      expect(result.summary.totalBefore).toBe(190000);
      expect(result.summary.totalAfter).toBe(200000);
      expect(result.summary.contribution).toBe(10000);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');
      const bonds = result.transactions.find(t => t.name === 'Bonds');

      // Expected transactions: rebalance and add contribution
      expect(stocks.amount).toBe(60000);   // Purchase 60,000 stocks
      expect(cash.amount).toBe(-20000);    // Sell 20,000 cash
      expect(bonds.amount).toBe(-30000);   // Sell 30,000 bonds

      // Verify final values
      expect(stocks.finalValue).toBe(160000);  // 100,000 + 60,000
      expect(cash.finalValue).toBe(20000);     // 40,000 - 20,000
      expect(bonds.finalValue).toBe(20000);    // 50,000 - 30,000

      // Verify final percentages match targets
      expect(stocks.finalPercent).toBe(80);    // 160,000 / 200,000 = 80%
      expect(cash.finalPercent).toBe(10);      // 20,000 / 200,000 = 10%
      expect(bonds.finalPercent).toBe(10);     // 20,000 / 200,000 = 10%

      // Verify sum of transactions equals contribution
      const totalTransaction = stocks.amount + cash.amount + bonds.amount;
      expect(totalTransaction).toBe(10000);
    });

    test('Removing $25,000 should remove $7,500 from Cash and $17,500 from Bonds', () => {
      const portfolio = [
        { name: 'Stocks', targetPercent: 80, currentValue: 100000, sell: false },
        { name: 'Cash', targetPercent: 10, currentValue: 40000, sell: true },
        { name: 'Bonds', targetPercent: 10, currentValue: 50000, sell: true }
      ];

      const result = rebalancePortfolio(-25000, portfolio);

      expect(result.summary.totalBefore).toBe(190000);
      expect(result.summary.totalAfter).toBe(165000);
      expect(result.summary.contribution).toBe(-25000);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');
      const bonds = result.transactions.find(t => t.name === 'Bonds');

      expect(stocks.amount).toBe(0);
      expect(cash.amount).toBe(-7500);
      expect(bonds.amount).toBe(-17500);

      expect(stocks.finalValue).toBe(100000);
      expect(cash.finalValue).toBe(32500);
      expect(bonds.finalValue).toBe(32500);

      // Verify sum of transactions equals withdrawal
      const totalTransaction = stocks.amount + cash.amount + bonds.amount;
      expect(totalTransaction).toBe(-25000);
    });

    test('Withdrawing $1,000 with all assets sellable: purchase 51.2K stocks, sell 21.1K cash, sell 31.1K bonds', () => {
      // Use base portfolio but make all assets sellable
      const portfolio = basePortfolio.map(asset => ({
        ...asset,
        sell: true
      }));

      const result = rebalancePortfolio(-1000, portfolio);

      expect(result.summary.totalBefore).toBe(190000);
      expect(result.summary.totalAfter).toBe(189000);
      expect(result.summary.contribution).toBe(-1000);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');
      const bonds = result.transactions.find(t => t.name === 'Bonds');

      // Expected transactions: internal rebalancing plus withdrawal
      expect(stocks.amount).toBe(51200);   // Purchase 51,200 stocks
      expect(cash.amount).toBe(-21100);    // Sell 21,100 cash
      expect(bonds.amount).toBe(-31100);   // Sell 31,100 bonds

      // Verify final values
      expect(stocks.finalValue).toBe(151200);  // 100,000 + 51,200
      expect(cash.finalValue).toBe(18900);     // 40,000 - 21,100
      expect(bonds.finalValue).toBe(18900);    // 50,000 - 31,100

      // Verify sum of transactions equals withdrawal
      const totalTransaction = stocks.amount + cash.amount + bonds.amount;
      expect(totalTransaction).toBe(-1000);
    });

    test('Withdrawing entire portfolio should result in all assets at $0', () => {
      const portfolio = [
        { name: 'Stocks', targetPercent: 80, currentValue: 100000, sell: true },
        { name: 'Cash', targetPercent: 10, currentValue: 40000, sell: true },
        { name: 'Bonds', targetPercent: 10, currentValue: 50000, sell: true }
      ];

      const totalValue = 190000;
      const result = rebalancePortfolio(-totalValue, portfolio);

      expect(result.summary.totalBefore).toBe(190000);
      expect(result.summary.totalAfter).toBe(0);
      expect(result.summary.contribution).toBe(-190000);

      // All assets should be withdrawn completely
      result.transactions.forEach(t => {
        expect(t.finalValue).toBe(0);
        expect(t.amount).toBe(-t.currentValue);
      });

      // Verify sum of transactions equals total withdrawal
      const totalTransaction = result.transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(totalTransaction).toBe(-190000);
    });
  });

  describe('Edge cases', () => {
    test('Starting with empty portfolio (all $0) should allocate according to targets', () => {
      const emptyPortfolio = [
        { name: 'Stocks', targetPercent: 80, currentValue: 0, sell: false },
        { name: 'Cash', targetPercent: 10, currentValue: 0, sell: false },
        { name: 'Bonds', targetPercent: 10, currentValue: 0, sell: false }
      ];

      const result = rebalancePortfolio(100000, emptyPortfolio);

      expect(result.summary.totalBefore).toBe(0);
      expect(result.summary.totalAfter).toBe(100000);
      expect(result.summary.contribution).toBe(100000);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');
      const bonds = result.transactions.find(t => t.name === 'Bonds');

      expect(stocks.amount).toBe(80000);
      expect(cash.amount).toBe(10000);
      expect(bonds.amount).toBe(10000);

      expect(stocks.finalValue).toBe(80000);
      expect(cash.finalValue).toBe(10000);
      expect(bonds.finalValue).toBe(10000);

      // Verify percentages are at target
      expect(stocks.finalPercent).toBe(80);
      expect(cash.finalPercent).toBe(10);
      expect(bonds.finalPercent).toBe(10);
    });

    test('Zero contribution should result in no changes', () => {
      const result = rebalancePortfolio(0, basePortfolio);

      expect(result.summary.contribution).toBe(0);
      result.transactions.forEach(t => {
        expect(t.amount).toBe(0);
        expect(t.finalValue).toBe(t.currentValue);
      });
    });

    test('Should handle already balanced portfolio', () => {
      const balancedPortfolio = [
        { name: 'Stocks', targetPercent: 50, currentValue: 50000, sell: false },
        { name: 'Bonds', targetPercent: 50, currentValue: 50000, sell: false }
      ];

      const result = rebalancePortfolio(0, balancedPortfolio);

      result.transactions.forEach(t => {
        expect(t.amount).toBe(0);
      });
    });

    test('Should handle small amounts with proper rounding', () => {
      const result = rebalancePortfolio(100.55, basePortfolio);

      const totalTransaction = result.transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(totalTransaction).toBe(100.55);
    });

    test('Should handle single asset portfolio', () => {
      const singleAsset = [
        { name: 'Stocks', targetPercent: 100, currentValue: 100000, sell: false }
      ];

      const result = rebalancePortfolio(10000, singleAsset);
      expect(result.transactions[0].amount).toBe(10000);
      expect(result.transactions[0].finalValue).toBe(110000);
    });
  });

  describe('Constraints and validation', () => {
    test('Should respect sell=false constraint during contributions', () => {
      const portfolio = [
        { name: 'Stocks', targetPercent: 50, currentValue: 100000, sell: false },
        { name: 'Bonds', targetPercent: 50, currentValue: 10000, sell: false }
      ];

      const result = rebalancePortfolio(10000, portfolio);

      // No assets should be sold (negative amounts)
      result.transactions.forEach(t => {
        expect(t.amount).toBeGreaterThanOrEqual(0);
      });
    });

    test('Should throw error if target percentages do not sum to 100', () => {
      const invalidPortfolio = [
        { name: 'Stocks', targetPercent: 50, currentValue: 100000, sell: false },
        { name: 'Bonds', targetPercent: 40, currentValue: 50000, sell: false }
      ];

      expect(() => rebalancePortfolio(10000, invalidPortfolio)).toThrow('Target percentages must sum to 100%');
    });

    test('Should throw error if withdrawal exceeds portfolio value', () => {
      expect(() => rebalancePortfolio(-200000, basePortfolio)).toThrow('Withdrawal amount exceeds total portfolio value');
    });

    test('Should throw error for empty asset array', () => {
      expect(() => rebalancePortfolio(10000, [])).toThrow('assetClasses must be a non-empty array');
    });

    test('Should throw error for non-array input', () => {
      expect(() => rebalancePortfolio(10000, null)).toThrow('assetClasses must be a non-empty array');
    });
  });

  describe('Rounding and precision', () => {
    test('All monetary values should be rounded to cents', () => {
      const result = rebalancePortfolio(12345.678, basePortfolio);

      result.transactions.forEach(t => {
        expect(t.amount).toBe(Math.round(t.amount * 100) / 100);
        expect(t.currentValue).toBe(Math.round(t.currentValue * 100) / 100);
        expect(t.finalValue).toBe(Math.round(t.finalValue * 100) / 100);
      });

      expect(result.summary.totalBefore).toBe(Math.round(result.summary.totalBefore * 100) / 100);
      expect(result.summary.totalAfter).toBe(Math.round(result.summary.totalAfter * 100) / 100);
      expect(result.summary.contribution).toBe(Math.round(result.summary.contribution * 100) / 100);
    });

    test('Sum of transactions should equal contribution amount exactly', () => {
      const amounts = [100, 1000.50, 25000, 325000, -25000, -10000.75];

      amounts.forEach(amount => {
        const portfolio = amount > 0 ? basePortfolio : basePortfolio.map(a => ({ ...a, sell: true }));
        const result = rebalancePortfolio(amount, portfolio);
        const totalTransaction = result.transactions.reduce((sum, t) => sum + t.amount, 0);
        
        expect(Math.abs(totalTransaction - amount)).toBeLessThan(0.01);
      });
    });

    test('Should handle floating-point edge cases without precision loss', () => {
      // Test with amounts that commonly cause floating-point precision issues
      const edgeCaseAmounts = [
        0.1 + 0.2,  // Famous 0.30000000000000004 case
        99.99,
        0.01,
        999999.99,
        1234.56,
        0.33 + 0.33 + 0.34  // Should equal 1.00
      ];

      edgeCaseAmounts.forEach(amount => {
        const portfolio = [
          { name: 'Asset1', targetPercent: 33.33, currentValue: 1000, sell: false },
          { name: 'Asset2', targetPercent: 33.33, currentValue: 1000, sell: false },
          { name: 'Asset3', targetPercent: 33.34, currentValue: 1000, sell: false }
        ];
        
        const result = rebalancePortfolio(amount, portfolio);
        
        // Verify all values are properly rounded to cents (no more than 2 decimal places)
        result.transactions.forEach(t => {
          // Due to floating-point arithmetic, multiplying by 100 may introduce tiny errors
          // So we check the rounded value is within a tiny tolerance
          const amountCents = Math.round(t.amount * 100);
          const finalValueCents = Math.round(t.finalValue * 100);
          
          expect(Math.abs(t.amount * 100 - amountCents)).toBeLessThan(0.0001);
          expect(Math.abs(t.finalValue * 100 - finalValueCents)).toBeLessThan(0.0001);
          
          // Verify the displayed values have exactly 2 decimal places
          expect(t.amount).toBe(amountCents / 100);
          expect(t.finalValue).toBe(finalValueCents / 100);
        });
        
        // Verify sum equals contribution (within reasonable floating-point tolerance)
        // Note: JavaScript's floating-point arithmetic can introduce tiny errors (< 0.02 cents)
        const totalTransaction = result.transactions.reduce((sum, t) => sum + t.amount, 0);
        expect(Math.abs(totalTransaction - amount)).toBeLessThan(0.02);
      });
    });

    test('Should maintain precision with very small percentages', () => {
      const portfolio = [
        { name: 'Main', targetPercent: 99.99, currentValue: 100000, sell: false },
        { name: 'Tiny', targetPercent: 0.01, currentValue: 10, sell: false }
      ];

      const result = rebalancePortfolio(10000, portfolio);
      
      // Even with tiny allocations, all values should be rounded properly
      result.transactions.forEach(t => {
        expect(t.amount * 100).toBe(Math.round(t.amount * 100));
        expect(t.finalValue * 100).toBe(Math.round(t.finalValue * 100));
      });
      
      const totalTransaction = result.transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(Math.abs(totalTransaction - 10000)).toBeLessThan(0.01);
    });

    test('Final values should exactly match sum of current values and transactions', () => {
      const result = rebalancePortfolio(12345.67, basePortfolio);
      
      result.transactions.forEach(t => {
        const calculatedFinal = t.currentValue + t.amount;
        expect(Math.abs(calculatedFinal - t.finalValue)).toBeLessThan(0.01);
      });
    });
  });

  describe('Output format', () => {
    test('Should return all required transaction fields', () => {
      const result = rebalancePortfolio(10000, basePortfolio);

      result.transactions.forEach(t => {
        expect(t).toHaveProperty('name');
        expect(t).toHaveProperty('amount');
        expect(t).toHaveProperty('currentValue');
        expect(t).toHaveProperty('finalValue');
        expect(t).toHaveProperty('targetPercent');
        expect(t).toHaveProperty('currentPercent');
        expect(t).toHaveProperty('finalPercent');
      });
    });

    test('Should return summary with all required fields', () => {
      const result = rebalancePortfolio(10000, basePortfolio);

      expect(result.summary).toHaveProperty('totalBefore');
      expect(result.summary).toHaveProperty('totalAfter');
      expect(result.summary).toHaveProperty('contribution');
    });

    test('Should calculate percentages correctly', () => {
      const result = rebalancePortfolio(10000, basePortfolio);

      result.transactions.forEach(t => {
        const expectedCurrentPercent = Math.round((t.currentValue / result.summary.totalBefore) * 100 * 100) / 100;
        const expectedFinalPercent = Math.round((t.finalValue / result.summary.totalAfter) * 100 * 100) / 100;
        
        expect(t.currentPercent).toBe(expectedCurrentPercent);
        expect(t.finalPercent).toBe(expectedFinalPercent);
      });
    });
  });

  describe('Complex scenarios', () => {
    test('Should handle portfolio with many asset classes', () => {
      const complexPortfolio = [
        { name: 'US Stocks', targetPercent: 30, currentValue: 50000, sell: false },
        { name: 'International Stocks', targetPercent: 20, currentValue: 30000, sell: false },
        { name: 'Bonds', targetPercent: 25, currentValue: 40000, sell: false },
        { name: 'Real Estate', targetPercent: 15, currentValue: 20000, sell: false },
        { name: 'Cash', targetPercent: 10, currentValue: 10000, sell: false }
      ];

      const result = rebalancePortfolio(50000, complexPortfolio);

      const totalTransaction = result.transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(totalTransaction).toBe(50000);
      
      // All transactions should be non-negative (buys only)
      result.transactions.forEach(t => {
        expect(t.amount).toBeGreaterThanOrEqual(0);
      });
    });

    test('Should handle extreme imbalance', () => {
      const imbalancedPortfolio = [
        { name: 'Stocks', targetPercent: 80, currentValue: 10000, sell: false },
        { name: 'Cash', targetPercent: 10, currentValue: 80000, sell: false },
        { name: 'Bonds', targetPercent: 10, currentValue: 10000, sell: false }
      ];

      const result = rebalancePortfolio(100000, imbalancedPortfolio);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      // Stocks should receive most of the contribution since they're most under-weighted
      expect(stocks.amount).toBeGreaterThan(50000);
    });
  });
});
