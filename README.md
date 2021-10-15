# Wagyu BEP20 Contract

### Deployments

| Contract | Address (mainnet) | Notes |
|-|-|-|
| `$WAG` | [`0x7FA7dF4996AC59F398476892cfB195eD38543520`](https://bscscan.com/token/0x7FA7dF4996AC59F398476892cfB195eD38543520) | $WAG Token |
### Development

Install dependencies via NPM:

```bash
npm i -D
```

Compile contracts via Hardhat:

```bash
npx hardhat compile
```

### Networks

By default, Hardhat uses the Hardhat Network in-process.

### Testing

To run the tests via Hardhat, run:

```bash
npx hardhat test
```

Generate a code coverage report using `solidity-coverage`:

```bash
npx hardhat coverage
```

Need to update init_hash in UniswapV2Factory to for local Uniswap instance to work.