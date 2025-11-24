# Portfolio Rebalance Calculator

[![Test](https://github.com/ianneub/portfolio-rebalance/actions/workflows/test.yml/badge.svg)](https://github.com/ianneub/portfolio-rebalance/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/ianneub/portfolio-rebalance/branch/master/graph/badge.svg)](https://codecov.io/gh/ianneub/portfolio-rebalance)

A JavaScript calculator for optimal lazy portfolio rebalancing, designed for use in browsers supporting ES6+.

## Features

- ✅ **Optimal lazy rebalancing** - Gets as close as possible to your target allocation without unnecessary transactions
- ✅ **Internal rebalancing** - Rebalance by selling overweighted assets to buy underweighted ones without external funds
- ✅ **Contribution & withdrawal support** - Handle both adding and removing funds
- ✅ **Smart withdrawal strategy** - Prioritizes achieving perfect balance when possible, respects sell flags
- ✅ **Precise calculations** - All monetary values rounded to cents
- ✅ **Comprehensive output** - Returns detailed transaction data and final allocations
- ✅ **ES Module format** - Ready for browser import
- ✅ **Fully tested** - Comprehensive test suite with automatic CI testing

## Installation

```bash
npm install
```

## Usage

### Basic Example

```javascript
import { rebalancePortfolio } from './src/rebalancer.js';

const portfolio = [
  { name: 'Stocks', targetPercent: 80, currentValue: 100000, sell: false },
  { name: 'Cash', targetPercent: 10, currentValue: 40000, sell: false },
  { name: 'Bonds', targetPercent: 10, currentValue: 50000, sell: false }
];

// Add $25,000 to portfolio
const result = rebalancePortfolio(25000, portfolio);

console.log(result);
```

### Output Format

```javascript
{
  transactions: [
    {
      name: "Stocks",
      amount: 25000.00,        // Positive = buy, Negative = sell
      currentValue: 100000.00,
      finalValue: 125000.00,
      targetPercent: 80,
      currentPercent: 52.63,
      finalPercent: 58.14
    },
    {
      name: "Cash",
      amount: 0.00,
      currentValue: 40000.00,
      finalValue: 40000.00,
      targetPercent: 10,
      currentPercent: 21.05,
      finalPercent: 18.60
    },
    {
      name: "Bonds",
      amount: 0.00,
      currentValue: 50000.00,
      finalValue: 50000.00,
      targetPercent: 10,
      currentPercent: 26.32,
      finalPercent: 23.26
    }
  ],
  summary: {
    totalBefore: 190000.00,
    totalAfter: 215000.00,
    contribution: 25000.00
  }
}
```

### Browser Usage

```html
<!DOCTYPE html>
<html>
<head>
  <title>Portfolio Rebalancer</title>
</head>
<body>
  <script type="module">
    import { rebalancePortfolio } from './src/rebalancer.js';
    
    const portfolio = [
      { name: 'Stocks', targetPercent: 60, currentValue: 50000, sell: false },
      { name: 'Bonds', targetPercent: 40, currentValue: 30000, sell: false }
    ];
    
    const result = rebalancePortfolio(10000, portfolio);
    console.log('Rebalancing result:', result);
  </script>
</body>
</html>
```

## API

### `calculateBalancingContribution(assetClasses)`

Calculates the minimum contribution amount needed to perfectly balance a portfolio to its target allocation.

#### Parameters

- **assetClasses** (Array): Array of asset objects with the following properties:
  - **name** (string): Asset name
  - **targetPercent** (number): Target allocation percentage (0-100)
  - **currentValue** (number): Current value of the asset
  - **sell** (boolean): Whether the asset can be sold (not used in this calculation)

#### Returns

- **number**: The contribution amount needed to perfectly balance the portfolio (rounded to cents)

#### Description

This function determines how much money you need to contribute to bring your portfolio into perfect balance with your target allocation. It calculates this by finding the most over-weighted asset and determining the total portfolio value needed for that asset to reach its target percentage.

The calculation works as follows:

- For each asset: required_total = current_value × 100 / target_percent
- The maximum required_total determines the contribution needed
- Returns 0 if the portfolio is already balanced

#### Example

```javascript
import { calculateBalancingContribution } from './src/rebalancer.js';

const portfolio = [
  { name: 'Stocks', targetPercent: 80, currentValue: 100000, sell: false },
  { name: 'Cash', targetPercent: 10, currentValue: 40000, sell: false },
  { name: 'Bonds', targetPercent: 10, currentValue: 50000, sell: false }
];

// Calculate how much to contribute to perfectly balance the portfolio
const contribution = calculateBalancingContribution(portfolio);
console.log(`Contribute $${contribution.toLocaleString()} to balance portfolio`);
// Output: Contribute $310,000 to balance portfolio

// Use the calculated amount with rebalancePortfolio
const result = rebalancePortfolio(contribution, portfolio);
// Portfolio is now perfectly balanced!
```

#### Throws

- Error if `assetClasses` is an empty array
- Error if target percentages do not sum to 100%

### `rebalancePortfolio(amount, assetClasses)`

Calculates optimal rebalancing transactions for a portfolio.

#### Parameters

- **amount** (number): Amount to contribute (positive) or withdraw (negative). Use 0 to perform internal rebalancing only.
- **assetClasses** (Array): Array of asset objects with the following properties:
  - **name** (string): Asset name
  - **targetPercent** (number): Target allocation percentage (0-100)
  - **currentValue** (number): Current value of the asset
  - **sell** (boolean): Whether the asset can be sold during rebalancing. When set to `true`, enables internal rebalancing by selling overweighted sellable assets to buy underweighted assets. During withdrawals, sellable assets are prioritized.

#### Returns

Object with the following structure:

- **transactions** (Array): Array of transaction objects for each asset
  - **name** (string): Asset name
  - **amount** (number): Amount to buy (positive) or sell (negative)
  - **currentValue** (number): Current value before rebalancing
  - **finalValue** (number): Final value after rebalancing
  - **targetPercent** (number): Target allocation percentage
  - **currentPercent** (number): Current allocation percentage
  - **finalPercent** (number): Final allocation percentage after rebalancing
- **summary** (Object): Portfolio summary
  - **totalBefore** (number): Total portfolio value before rebalancing
  - **totalAfter** (number): Total portfolio value after rebalancing
  - **contribution** (number): Contribution or withdrawal amount

#### Throws

- Error if `assetClasses` is an empty array
- Error if target percentages do not sum to 100%
- Error if withdrawal amount exceeds total portfolio value

## Examples

### Example 1: Adding Funds

```javascript
const portfolio = [
  { name: 'Stocks', targetPercent: 80, currentValue: 100000, sell: false },
  { name: 'Cash', targetPercent: 10, currentValue: 40000, sell: false },
  { name: 'Bonds', targetPercent: 10, currentValue: 50000, sell: false }
];

const result = rebalancePortfolio(325000, portfolio);

// Result:
// Stocks: +$312,000
// Cash: +$11,500
// Bonds: +$1,500
```

### Example 2: Withdrawing Funds

```javascript
const portfolio = [
  { name: 'Stocks', targetPercent: 80, currentValue: 100000, sell: false },
  { name: 'Cash', targetPercent: 10, currentValue: 40000, sell: false },
  { name: 'Bonds', targetPercent: 10, currentValue: 50000, sell: false }
];

const result = rebalancePortfolio(-25000, portfolio);

// Result: Algorithm achieves PERFECT balance at target allocation
// Total after: $165,000
// Stocks: $0 (ends at $100,000 = 80% target)
// Cash: -$7,500 (ends at $32,500 = 10% target)
// Bonds: -$17,500 (ends at $32,500 = 10% target)
// Perfect balance achieved: Stocks 80%, Cash 10%, Bonds 10%
```

### Example 3: Internal Rebalancing (Without External Funds)

```javascript
const portfolio = [
  { name: 'Stocks', targetPercent: 60, currentValue: 50000, sell: false },
  { name: 'Bonds', targetPercent: 40, currentValue: 30000, sell: false },
  { name: 'Cash', targetPercent: 0, currentValue: 20000, sell: true }
];

// Rebalance by selling overweighted Cash to buy underweighted assets
const result = rebalancePortfolio(0, portfolio);

// Result: Internal rebalancing achieves perfect allocation
// Cash: -$20,000 (sell all cash)
// Stocks: +$10,000 (buy to reach 60% = $60,000)
// Bonds: +$10,000 (buy to reach 40% = $40,000)
// Perfect balance achieved without external funds!
```

### Example 4: Auto-Calculate Perfect Balance

```javascript
import { calculateBalancingContribution, rebalancePortfolio } from './src/rebalancer.js';

const portfolio = [
  { name: 'Stocks', targetPercent: 80, currentValue: 100000, sell: false },
  { name: 'Cash', targetPercent: 10, currentValue: 40000, sell: false },
  { name: 'Bonds', targetPercent: 10, currentValue: 50000, sell: false }
];

// First, calculate how much to contribute for perfect balance
const needed = calculateBalancingContribution(portfolio);
console.log(`Need to contribute: $${needed.toLocaleString()}`);
// Output: Need to contribute: $310,000

// Then rebalance with that amount
const result = rebalancePortfolio(needed, portfolio);

// Verify perfect balance
result.transactions.forEach(t => {
  console.log(`${t.name}: ${t.finalPercent}% (target: ${t.targetPercent}%)`);
});
// Output:
// Stocks: 80% (target: 80%)
// Cash: 10% (target: 10%)
// Bonds: 10% (target: 10%)
```

### Example 5: Complex Portfolio

```javascript
const portfolio = [
  { name: 'US Stocks', targetPercent: 30, currentValue: 50000, sell: false },
  { name: 'International Stocks', targetPercent: 20, currentValue: 30000, sell: false },
  { name: 'Bonds', targetPercent: 25, currentValue: 40000, sell: false },
  { name: 'Real Estate', targetPercent: 15, currentValue: 20000, sell: false },
  { name: 'Cash', targetPercent: 10, currentValue: 10000, sell: false }
];

const result = rebalancePortfolio(50000, portfolio);
// Calculator optimally distributes funds to get closest to target allocations
```

## How It Works

The calculator uses a greedy optimization approach:

1. **Calculate current state**: Determines total portfolio value and current allocations
2. **Determine targets**: Calculates target values after contribution/withdrawal
3. **Find most imbalanced asset**: Uses fractional deviation to identify which asset needs adjustment most
4. **Make optimal transaction**: Allocates/withdraws funds to/from that asset
5. **Repeat**: Continues until all funds are allocated or optimal balance is achieved
6. **Return results**: Provides detailed breakdown of all transactions

This approach ensures you get as close as possible to your target allocation while minimizing transaction complexity and respecting constraints.

## Algorithm Details

The calculator implements an **optimal lazy rebalancing** algorithm with intelligent handling of internal rebalancing and withdrawals:

### Internal Rebalancing (when assets have `sell: true`)

When assets are marked as sellable (`sell: true`), the algorithm performs **internal rebalancing** to achieve perfect balance:

1. **Before applying contributions**: If contributing and sellable assets exist, first rebalances internally by selling overweighted sellable assets and buying underweighted sellable assets
2. **Zero-contribution rebalancing**: With `amount = 0`, can rebalance portfolio by selling overweighted sellable assets to buy underweighted ones, achieving perfect target allocation without external funds
3. **Iterative optimization**: Uses fractional deviation to identify most overweighted sellable asset to sell and most underweighted asset to buy

### For Contributions (positive amount)

1. Performs internal rebalancing first (if sellable assets exist)
2. Calculates target values for each asset based on new total
3. Iteratively allocates funds to the most under-weighted asset
4. Maximizes the minimum fractional deviation across all assets
5. Only buys assets during contribution phase

### For Withdrawals (negative amount)

The algorithm uses a **smart multi-strategy approach** that prioritizes achieving perfect balance:

1. **Perfect Balance Priority**: First checks if withdrawal can achieve perfect target allocation
   - If yes, withdraws in amounts that result in exact target percentages (regardless of sell flags)
   - This is the optimal outcome and is prioritized when mathematically possible

2. **Sellable Assets Strategy**: If perfect balance isn't achievable and sellable assets exist:
   - Withdraws only from assets marked `sell: true`
   - Starts with most overweighted sellable assets
   - Falls back to proportional withdrawal from all assets if sellable assets insufficient

3. **No Sellable Assets**: If no assets are sellable:
   - Withdraws from most overweighted assets first
   - Uses iterative approach to minimize maximum fractional deviation
   - Falls back to proportional withdrawal if needed

**Fractional deviation** = (actual_allocation / target_allocation) - 1

All monetary values are rounded to 2 decimal places (cents).

## Understanding Withdrawal Behavior

The withdrawal algorithm has sophisticated behavior that depends on your portfolio state and which assets are marked as sellable:

### When Perfect Balance is Achievable

If the withdrawal amount allows the remaining portfolio to hit exact target percentages, the algorithm will **always prioritize achieving perfect balance**, regardless of sell flags. This is the optimal outcome.

**Example**: Portfolio with $190,000 where Stocks need to be 80% but are currently 52.6%. Withdrawing $25,000 leaves $165,000, and $132,000 (80%) can stay in Stocks while withdrawing entirely from overweighted assets.

### When Sellable Assets Exist

If some assets have `sell: true`:

- Algorithm attempts to withdraw only from sellable assets
- If sellable assets can't cover the full withdrawal, falls back to proportional withdrawal from all assets
- This protects assets you don't want to sell (like tax-advantaged accounts or long-term holdings)

### When No Sellable Assets

If all assets have `sell: false`:

- Withdraws from most overweighted assets first
- Attempts to minimize portfolio imbalance
- May use proportional withdrawal if no better strategy exists

### Why This Matters

Understanding these behaviors helps you:

- **Tax optimization**: Mark taxable accounts as `sell: true` to withdraw from them first
- **Strategic rebalancing**: Use withdrawals as rebalancing opportunities
- **Account protection**: Keep `sell: false` on accounts you want to preserve (401k, IRA, etc.)

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:coverage
```

### Test Cases Included

- ✅ Edge cases (zero contribution, balanced portfolio, etc.)
- ✅ Constraint validation (respecting sell flags)
- ✅ Rounding and precision tests
- ✅ Complex multi-asset portfolios
- ✅ Extreme imbalance scenarios

## Continuous Integration

This project uses GitHub Actions to automatically run tests on every push and pull request. Tests run against Node.js versions 18.x, 20.x, and 22.x.

## License

MIT

## References

This calculator is inspired by:

- [Rich Snapp's Rebalancing Calculator](https://www.richsnapp.com/blog/2020/09-25-rebalancing-your-lazy-portfolio)
- [Optimal Rebalancing Info](https://optimalrebalancing.info/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
