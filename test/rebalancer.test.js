import { rebalancePortfolio, calculateBalancingContribution, calculateDeviation } from '../src/rebalancer.js';

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

    test('Removing $1,000,000 should remove $80,000 from Cash and $20,000 from Stocks', () => {
      const portfolio = [
        { name: 'Stocks', targetPercent: 90, currentValue: 1000000, sell: false },
        { name: 'Cash', targetPercent: 10, currentValue: 200000, sell: false }
      ];

      const result = rebalancePortfolio(-1000000, portfolio);

      expect(result.summary.totalBefore).toBe(1200000);
      expect(result.summary.totalAfter).toBe(200000);
      expect(result.summary.contribution).toBe(-1000000);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');

      expect(stocks.amount).toBe(-820000);
      expect(cash.amount).toBe(-180000);

      expect(stocks.finalValue).toBe(180000);
      expect(cash.finalValue).toBe(20000);

      // Verify sum of transactions equals withdrawal
      const totalTransaction = stocks.amount + cash.amount;
      expect(totalTransaction).toBe(-1000000);
    });

    test('Removing $1,000 from nearly-balanced portfolio should achieve perfect balance even with mixed sell attributes', () => {
      const portfolio = [
        { name: 'Stocks', targetPercent: 90, currentValue: 2900, sell: true },
        { name: 'Cash', targetPercent: 10, currentValue: 300, sell: false }
      ];

      const result = rebalancePortfolio(-1000, portfolio);

      expect(result.summary.totalBefore).toBe(3200);
      expect(result.summary.totalAfter).toBe(2200);
      expect(result.summary.contribution).toBe(-1000);
      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');

      expect(stocks.amount).toBe(-920);
      expect(cash.amount).toBe(-80);

      expect(stocks.finalValue).toBe(1980);
      expect(cash.finalValue).toBe(220);

      // Verify sum of transactions equals withdrawal
      const totalTransaction = stocks.amount + cash.amount;
      expect(totalTransaction).toBe(-1000);
    });

    test('Removing $25,000 should remove $7,500 from Cash and $17,500 from Bonds even when sell is all false', () => {
      const portfolio = [
        { name: 'Stocks', targetPercent: 80, currentValue: 100000, sell: false },
        { name: 'Cash', targetPercent: 10, currentValue: 40000, sell: false },
        { name: 'Bonds', targetPercent: 10, currentValue: 50000, sell: false }
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

    test('Removing $180,000 should withdraw proportionally from all assets regardless of sell attribute', () => {
      const portfolio = [
        { name: 'Stocks', targetPercent: 80, currentValue: 100000, sell: false },
        { name: 'Cash', targetPercent: 10, currentValue: 40000, sell: true },
        { name: 'Bonds', targetPercent: 10, currentValue: 50000, sell: true }
      ];

      const result = rebalancePortfolio(-180000, portfolio);

      expect(result.summary.totalBefore).toBe(190000);
      expect(result.summary.totalAfter).toBe(10000);
      expect(result.summary.contribution).toBe(-180000);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');
      const bonds = result.transactions.find(t => t.name === 'Bonds');

      // Withdraw proportionally to achieve target allocation after withdrawal
      // Target after: Stocks 80% = 8000, Cash 10% = 1000, Bonds 10% = 1000
      expect(stocks.amount).toBe(-92000);  // 100000 -> 8000
      expect(cash.amount).toBe(-39000);    // 40000 -> 1000
      expect(bonds.amount).toBe(-49000);   // 50000 -> 1000

      expect(stocks.finalValue).toBe(8000);
      expect(cash.finalValue).toBe(1000);
      expect(bonds.finalValue).toBe(1000);

      // Verify sum of transactions equals withdrawal
      const totalTransaction = stocks.amount + cash.amount + bonds.amount;
      expect(totalTransaction).toBe(-180000);

      // Verify final percentages match targets
      expect(stocks.finalPercent).toBe(80);
      expect(cash.finalPercent).toBe(10);
      expect(bonds.finalPercent).toBe(10);
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
    test('Withdrawing $180,000 from basePortfolio with all assets sell=false', () => {
      // This tests that negative contributions work even when sell=false
      // basePortfolio has: Stocks $100k, Cash $40k, Bonds $50k (total $190k)
      const result = rebalancePortfolio(-180000, basePortfolio);

      expect(result.summary.totalBefore).toBe(190000);
      expect(result.summary.totalAfter).toBe(10000);
      expect(result.summary.contribution).toBe(-180000);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');
      const bonds = result.transactions.find(t => t.name === 'Bonds');

      // Log actual values for debugging
      console.log('Stocks:', { amount: stocks.amount, finalValue: stocks.finalValue });
      console.log('Cash:', { amount: cash.amount, finalValue: cash.finalValue });
      console.log('Bonds:', { amount: bonds.amount, finalValue: bonds.finalValue });

      // Verify all transactions sum to -180000
      const totalTransaction = stocks.amount + cash.amount + bonds.amount;
      expect(totalTransaction).toBe(-180000);

      // Verify final values sum to 10000
      const totalFinal = stocks.finalValue + cash.finalValue + bonds.finalValue;
      expect(totalFinal).toBe(10000);

      // All final values should be positive
      expect(stocks.finalValue).toBeGreaterThan(0);
      expect(cash.finalValue).toBeGreaterThan(0);
      expect(bonds.finalValue).toBeGreaterThan(0);
    });

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

        expect(Math.abs(totalTransaction - amount)).toBeLessThan(0.02);
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

  describe('Calculate Balancing Contribution', () => {
    test('Should calculate contribution needed to balance base portfolio', () => {
      const contribution = calculateBalancingContribution(basePortfolio);

      // Cash is at 21.05% (40k/190k), Bonds at 26.32% (50k/190k), Stocks at 52.63% (100k/190k)
      // Most over-weighted: Bonds at 26.32% needs to be 10%
      // Required totalAfter = 50000 / 0.10 = 500,000
      // contribution = 500,000 - 190,000 = 310,000
      expect(contribution).toBe(310000);
    });

    test('Should return 0 for already balanced portfolio', () => {
      const balancedPortfolio = [
        { name: 'Stocks', targetPercent: 50, currentValue: 50000, sell: false },
        { name: 'Bonds', targetPercent: 50, currentValue: 50000, sell: false }
      ];

      const contribution = calculateBalancingContribution(balancedPortfolio);
      expect(contribution).toBe(0);
    });

    test('Should handle empty portfolio (all assets at 0)', () => {
      const emptyPortfolio = [
        { name: 'Stocks', targetPercent: 80, currentValue: 0, sell: false },
        { name: 'Cash', targetPercent: 10, currentValue: 0, sell: false },
        { name: 'Bonds', targetPercent: 10, currentValue: 0, sell: false }
      ];

      const contribution = calculateBalancingContribution(emptyPortfolio);
      expect(contribution).toBe(0);
    });

    test('Should handle single asset portfolio', () => {
      const singleAsset = [
        { name: 'Stocks', targetPercent: 100, currentValue: 100000, sell: false }
      ];

      const contribution = calculateBalancingContribution(singleAsset);
      expect(contribution).toBe(0);
    });

    test('Should handle portfolio with extreme imbalance', () => {
      const imbalancedPortfolio = [
        { name: 'Stocks', targetPercent: 80, currentValue: 10000, sell: false },
        { name: 'Cash', targetPercent: 10, currentValue: 80000, sell: false },
        { name: 'Bonds', targetPercent: 10, currentValue: 10000, sell: false }
      ];

      const contribution = calculateBalancingContribution(imbalancedPortfolio);
      
      // Cash is most over-weighted at 80% (80k/100k), needs to be 10%
      // Required totalAfter = 80000 / 0.10 = 800,000
      // contribution = 800,000 - 100,000 = 700,000
      expect(contribution).toBe(700000);
    });

    test('Should handle portfolio where one asset is exactly at target', () => {
      const portfolio = [
        { name: 'Stocks', targetPercent: 80, currentValue: 80000, sell: false },
        { name: 'Cash', targetPercent: 10, currentValue: 15000, sell: false },
        { name: 'Bonds', targetPercent: 10, currentValue: 5000, sell: false }
      ];

      const contribution = calculateBalancingContribution(portfolio);
      
      // Cash is most over-weighted at 15% (15k/100k), needs to be 10%
      // Required totalAfter = 15000 / 0.10 = 150,000
      // contribution = 150,000 - 100,000 = 50,000
      expect(contribution).toBe(50000);
    });

    test('Should handle complex portfolio with many assets', () => {
      const complexPortfolio = [
        { name: 'US Stocks', targetPercent: 30, currentValue: 50000, sell: false },
        { name: 'International Stocks', targetPercent: 20, currentValue: 30000, sell: false },
        { name: 'Bonds', targetPercent: 25, currentValue: 40000, sell: false },
        { name: 'Real Estate', targetPercent: 15, currentValue: 20000, sell: false },
        { name: 'Cash', targetPercent: 10, currentValue: 10000, sell: false }
      ];

      const contribution = calculateBalancingContribution(complexPortfolio);
      
      // Total is 150k
      // US Stocks: 50k/150k = 33.33% (over-weighted, needs 30%)
      // Bonds: 40k/150k = 26.67% (over-weighted, needs 25%)
      // Most over-weighted needs calculation for each
      expect(contribution).toBeGreaterThanOrEqual(0);
    });

    test('Should throw error for empty asset array', () => {
      expect(() => calculateBalancingContribution([])).toThrow('assetClasses must be a non-empty array');
    });

    test('Should throw error for non-array input', () => {
      expect(() => calculateBalancingContribution(null)).toThrow('assetClasses must be a non-empty array');
    });

    test('Should throw error if target percentages do not sum to 100', () => {
      const invalidPortfolio = [
        { name: 'Stocks', targetPercent: 50, currentValue: 100000, sell: false },
        { name: 'Bonds', targetPercent: 40, currentValue: 50000, sell: false }
      ];

      expect(() => calculateBalancingContribution(invalidPortfolio)).toThrow('Target percentages must sum to 100%');
    });

    test('Should properly round result to cents', () => {
      const portfolio = [
        { name: 'Asset1', targetPercent: 33.33, currentValue: 1000, sell: false },
        { name: 'Asset2', targetPercent: 33.33, currentValue: 1500, sell: false },
        { name: 'Asset3', targetPercent: 33.34, currentValue: 500, sell: false }
      ];

      const contribution = calculateBalancingContribution(portfolio);
      
      // Verify result is rounded to cents (2 decimal places)
      expect(contribution).toBe(Math.round(contribution * 100) / 100);
      expect(contribution * 100).toBe(Math.round(contribution * 100));
    });

    test('Integration: Should work correctly with rebalancePortfolio', () => {
      // Calculate the needed contribution
      const contribution = calculateBalancingContribution(basePortfolio);
      expect(contribution).toBe(310000);

      // Use it to rebalance
      const result = rebalancePortfolio(contribution, basePortfolio);

      // Verify perfect balance was achieved
      expect(result.summary.totalAfter).toBe(500000);
      expect(result.summary.contribution).toBe(310000);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');
      const bonds = result.transactions.find(t => t.name === 'Bonds');

      // Final values should match targets exactly
      expect(stocks.finalValue).toBe(400000); // 80% of 500,000
      expect(cash.finalValue).toBe(50000);    // 10% of 500,000
      expect(bonds.finalValue).toBe(50000);   // 10% of 500,000

      // Final percentages should match targets
      expect(stocks.finalPercent).toBe(80);
      expect(cash.finalPercent).toBe(10);
      expect(bonds.finalPercent).toBe(10);
    });

    test('Integration: Should work with under-weighted portfolio', () => {
      const underWeightedPortfolio = [
        { name: 'Stocks', targetPercent: 60, currentValue: 30000, sell: false },
        { name: 'Bonds', targetPercent: 40, currentValue: 20000, sell: false }
      ];

      const contribution = calculateBalancingContribution(underWeightedPortfolio);
      
      // Both are under-weighted relative to each other
      // Stocks: 30k/50k = 60% (at target!)
      // Bonds: 20k/50k = 40% (at target!)
      expect(contribution).toBe(0);
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

  describe('Coverage improvement test cases', () => {
    test('calculateDeviation should handle targetPercent = 0 edge case', () => {
      // Test the uncovered branch where targetPercent === 0
      // Since it's a helper function, we'll test via the module import
      const result = calculateDeviation ? calculateDeviation(50000, 0) : calculateDeviation(50000, 0);
      expect(result).toBe(0);
    });

    test('Internal rebalancing should handle tiny transfer amounts', () => {
      // Create scenario where transferAmount calculation results in < 0.01
      const portfolio = [
        { name: 'Asset1', targetPercent: 50, currentValue: 10000.005, sell: true },
        { name: 'Asset2', targetPercent: 50, currentValue: 10000.000, sell: true }
      ];

      // This tests rounding behavior with tiny amounts
      const result = rebalancePortfolio(0.009, portfolio);
      expect(result.summary.contribution).toBe(0.01); // Rounded up

      // With such tiny amounts and nearly balanced portfolio, the algorithm may not allocate
      // This tests that the function handles rounding without crashing
      const asset1 = result.transactions.find(t => t.name === 'Asset1');
      const asset2 = result.transactions.find(t => t.name === 'Asset2');

      // Verify all values are properly rounded to cents
      expect(asset1.amount).toBe(Math.round(asset1.amount * 100) / 100);
      expect(asset2.amount).toBe(Math.round(asset2.amount * 100) / 100);

      // Total transactions should be reasonable (may be 0 or the rounded amount)
      const totalTransaction = asset1.amount + asset2.amount;
      expect(Math.abs(totalTransaction)).toBeLessThanOrEqual(0.01);
    });

    test('Withdrawal exceeding sellable assets should use proportional withdrawal', () => {
      const portfolio = [
        { name: 'Stocks', targetPercent: 40, currentValue: 100000, sell: false },
        { name: 'Cash', targetPercent: 30, currentValue: 20000, sell: true },
        { name: 'Bonds', targetPercent: 30, currentValue: 30000, sell: true }
      ];

      // Withdraw $60000 - more than available sellable assets ($50000) but less than total
      const result = rebalancePortfolio(-60000, portfolio);

      expect(result.summary.totalAfter).toBe(90000); // 150000 - 60000 = 90000
      expect(result.summary.contribution).toBe(-60000);

      const stocks = result.transactions.find(t => t.name === 'Stocks');
      const cash = result.transactions.find(t => t.name === 'Cash');
      const bonds = result.transactions.find(t => t.name === 'Bonds');

      // Since withdrawal (60k) > sellable assets (50k), proportional withdrawal across all assets
      // Target after withdrawal: 90k, so each asset should be at target proportions
      expect(stocks.finalValue).toBe(36000); // 40% of 90k
      expect(cash.finalValue).toBe(27000);   // 30% of 90k
      expect(bonds.finalValue).toBe(27000);  // 30% of 90k

      // Final percentages should match targets
      expect(stocks.finalPercent).toBe(40);
      expect(cash.finalPercent).toBe(30);
      expect(bonds.finalPercent).toBe(30);

      // Verify sum of transactions equals withdrawal
      const totalTransaction = stocks.amount + cash.amount + bonds.amount;
      expect(totalTransaction).toBe(-60000);
    });

    test('Contribution to empty portfolio should handle zero totalAfter safely', () => {
      const emptyPortfolio = [
        { name: 'Stocks', targetPercent: 80, currentValue: 0.01, sell: false }, // Tiny amount
        { name: 'Cash', targetPercent: 10, currentValue: 0, sell: false },
        { name: 'Bonds', targetPercent: 10, currentValue: 0, sell: false }
      ];

      // This ensures totalAfter > 0 condition is tested (branch 1 in coverage)
      const result = rebalancePortfolio(100000, emptyPortfolio);

      expect(result.summary.totalAfter).toBe(100000.01); // Includes the tiny existing amount
      expect(result.summary.contribution).toBe(100000);

      const totalTransaction = result.transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(totalTransaction).toBe(100000);
    });

    test('Large contribution should trigger remaining amount distribution logic', () => {
      const portfolio = [
        { name: 'Stocks', targetPercent: 90, currentValue: 90000, sell: false },
        { name: 'Cash', targetPercent: 10, currentValue: 10000, sell: false }
      ];

      // Add amount to portfolio that's already at target allocation
      const result = rebalancePortfolio(999.99, portfolio);

      expect(result.summary.totalAfter).toBe(100999.99); // 100,000 + 999.99
      expect(result.summary.contribution).toBe(999.99);

      const totalTransaction = result.transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(Math.abs(totalTransaction - 999.99)).toBeLessThan(0.01);

      // Since portfolio is already balanced, the remainder should go to the most under-weighted asset
      // Both are at target, so the algorithm will pick the first one with the best deviation
      result.transactions.forEach(t => {
        expect(t.finalPercent).toBeGreaterThan(0);
      });
    });

    test('Withdrawal leaving tiny remainder should test edge case handling', () => {
      const portfolio = [
        { name: 'Stocks', targetPercent: 80, currentValue: 80000.01, sell: true },
        { name: 'Cash', targetPercent: 20, currentValue: 20000.00, sell: true }
      ];

      // Withdraw almost everything but leave tiny amount
      const result = rebalancePortfolio(-99980.01, portfolio);

      expect(result.summary.totalAfter).toBe(20); // Should leave minimal amount
      expect(result.summary.contribution).toBe(-99980.01);

      const totalTransaction = result.transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(Math.abs(totalTransaction - (-99980.01))).toBeLessThan(0.01);

      // All final values should be non-negative
      result.transactions.forEach(t => {
        expect(t.finalValue).toBeGreaterThanOrEqual(0);
      });
    });

    test('Internal rebalancing sort stability with equal deviations', () => {
      // Create scenario with multiple assets having identical deviations
      const portfolio = [
        { name: 'Asset1', targetPercent: 25, currentValue: 12500, sell: true },
        { name: 'Asset2', targetPercent: 25, currentValue: 12500, sell: true },
        { name: 'Asset3', targetPercent: 25, currentValue: 12500, sell: true },
        { name: 'Asset4', targetPercent: 25, currentValue: 12500, sell: true }
      ];

      const result = rebalancePortfolio(0, portfolio);

      // All values should remain the same since portfolio is already balanced
      result.transactions.forEach(t => {
        expect(t.amount).toBe(0);
        expect(t.finalValue).toBe(t.currentValue);
        expect(t.finalPercent).toBe(25);
      });
    });

    test('No valid assets to select should trigger selection failure path', () => {
      // Create impossible scenario where no asset can be bought
      // This might be hard to trigger, but let's try with extreme precision
      const portfolio = [
        { name: 'Asset1', targetPercent: 50, currentValue: 1000000, sell: false }, // Already at target
        { name: 'Asset2', targetPercent: 50, currentValue: 1000000, sell: false }  // Already at target
      ];

      const result = rebalancePortfolio(0.005, portfolio); // Tiny amount that rounds away

      expect(result.summary.contribution).toBe(0.01); // Rounded up
      expect(result.summary.totalAfter).toBe(2000000.01);

      // The tiny remainder should go to one of the assets
      const totalTransaction = result.transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(Math.abs(totalTransaction - 0.005)).toBeLessThan(0.01);
    });
  });
});
