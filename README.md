# Portfolio Rebalance Calculator

A JavaScript calculator for optimal lazy portfolio rebalancing, designed for use in browsers supporting ES6+.

## Features

- ✅ **Optimal lazy rebalancing** - Gets as close as possible to your target allocation without unnecessary transactions
- ✅ **Contribution & withdrawal support** - Handle both adding and removing funds
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
      targetPercent: 80.0,
      currentPercent: 52.63,
      finalPercent: 58.14
    },
    {
      name: "Cash",
      amount: 0.00,
      currentValue: 40000.00,
      finalValue: 40000.00,
      targetPercent: 10.0,
      currentPercent: 21.05,
      finalPercent: 18.60
    },
    {
      name: "Bonds",
      amount: 0.00,
      currentValue: 50000.00,
      finalValue: 50000.00,
      targetPercent: 10.0,
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

- **amount** (number): Amount to contribute (positive) or withdraw (negative)
- **assetClasses** (Array): Array of asset objects with the following properties:
  - **name** (string): Asset name
  - **targetPercent** (number): Target allocation percentage (0-100)
  - **currentValue** (number): Current value of the asset
  - **sell** (boolean): Reserved for future use (not currently used in rebalancing logic)

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

// Result: Sells from most over-weighted assets to minimize deviation
// Cash: -$7,500
// Bonds: -$17,500
// Stocks: $0 (most under-weighted, no need to sell)
```

### Example 3: Auto-Calculate Perfect Balance

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

### Example 4: Complex Portfolio

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

## Algorithm

The calculator implements an **optimal lazy rebalancing** algorithm:

### For Contributions (positive amount):

1. Calculates target values for each asset based on new total
2. Iteratively allocates funds to the most under-weighted asset
3. Maximizes the minimum fractional deviation across all assets
4. Only buys assets (no selling unless explicitly allowed)

### For Withdrawals (negative amount):

1. Calculates target values for each asset based on new total
2. Iteratively withdraws funds from the most over-weighted asset
3. Minimizes the maximum fractional deviation across all assets
4. All assets are eligible for selling during withdrawals

**Fractional deviation** = (actual_allocation / target_allocation) - 1

All monetary values are rounded to 2 decimal places (cents).

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

- ✅ All user-provided test scenarios
- ✅ Edge cases (zero contribution, balanced portfolio, etc.)
- ✅ Constraint validation (respecting sell flags)
- ✅ Rounding and precision tests
- ✅ Complex multi-asset portfolios
- ✅ Extreme imbalance scenarios

## Continuous Integration

This project uses GitHub Actions to automatically run tests on every push and pull request. Tests run against Node.js versions 18.x, 20.x, and 22.x.

## How It Works

The calculator uses a greedy optimization approach:

1. **Calculate current state**: Determines total portfolio value and current allocations
2. **Determine targets**: Calculates target values after contribution/withdrawal
3. **Find most imbalanced asset**: Uses fractional deviation to identify which asset needs adjustment most
4. **Make optimal transaction**: Allocates/withdraws funds to/from that asset
5. **Repeat**: Continues until all funds are allocated or optimal balance is achieved
6. **Return results**: Provides detailed breakdown of all transactions

This approach ensures you get as close as possible to your target allocation while minimizing transaction complexity and respecting constraints.

## License

MIT

## References

This calculator is inspired by:

- [Rich Snapp's Rebalancing Calculator](https://www.richsnapp.com/blog/2020/09-25-rebalancing-your-lazy-portfolio)
- [Optimal Rebalancing Info](https://optimalrebalancing.info/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
