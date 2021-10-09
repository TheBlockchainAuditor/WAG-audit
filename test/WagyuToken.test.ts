import { expect } from "chai";
import { Snapshot, tokens, timeLimit, increaseTime, ether, ZeroAddress }  from "./helpers";

// Types
import { WAG, UniswapV2Router02, UniswapV2Factory, WETH9, UniswapV2Pair } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"; 
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";


describe("WagyuSwap BEP20 Contract Test Suite", () => {
    
    let wag: WAG, factory: UniswapV2Factory, router: UniswapV2Router02, eth: WETH9, pair: UniswapV2Pair;
    let traders: SignerWithAddress[];
    let trader1: SignerWithAddress; 
    let trader2: SignerWithAddress; 
    let trader3: SignerWithAddress;
    let trader4: SignerWithAddress;
    let feeRecipient: SignerWithAddress;
    let owner: SignerWithAddress; 
    let oneMinute: number = 60;
    let oneHour: number = 60 * oneMinute;
    let oneDay: number = oneHour*24;
    let oneWeek: number = oneDay*7; 
    let oneYear: number = oneDay*365;

    const snapshot: Snapshot = new Snapshot();

    const swapTokens = async (amountSold: BigNumber, tokenSold: WAG | WETH9, tokenBought: WAG | WETH9, router: UniswapV2Router02, trader: SignerWithAddress) => {
        await tokenSold.connect(trader).approve(router.address, amountSold);
        await router.connect(trader).swapExactTokensForTokensSupportingFeeOnTransferTokens(amountSold, 0, [tokenSold.address, tokenBought.address], trader.address, timeLimit(60));
    };

    before("Deployment Snapshot", async () => {

        let signers: SignerWithAddress[] = await ethers.getSigners();
        owner = signers[0];
        trader1 = signers[1];
        trader2 = signers[2];
        trader3 = signers[3];
        trader4 = signers[4];
        feeRecipient = signers[5];
        traders = [trader1, trader2, trader3, trader4];

        const Factory = await ethers.getContractFactory('UniswapV2Factory');
        factory = await Factory.deploy(owner.address) as UniswapV2Factory;
        await factory.deployed();

        const WETH = await ethers.getContractFactory('WETH9');
        eth = (await WETH.deploy()) as WETH9;
        await eth.deployed();

        const Router = await ethers.getContractFactory('UniswapV2Router02');
        router = (await Router.deploy(factory.address, eth.address)) as UniswapV2Router02;
        await router.deployed();

        const Wag = await ethers.getContractFactory("WAG");
        wag = await (upgrades.deployProxy(Wag, [1000, feeRecipient.address, router.address], { initializer: 'initialize' })) as WAG;
        await wag.deployed();
        
        for (const trader of traders) {
          await wag.transfer(trader.address, tokens("10000"));
        }

        await owner.sendTransaction({
          to: eth.address,
          value: ether("500")
        });
        await trader1.sendTransaction({
          to: eth.address,
          value: ether("500")
        });
        await trader2.sendTransaction({
          to: eth.address,
          value: ether("500")
        });
        await trader3.sendTransaction({
          to: eth.address,
          value: ether("500")
        });
        await trader4.sendTransaction({
          to: eth.address,
          value: ether("500")
        });

        await factory.createPair(wag.address, eth.address)
        let pairAddress: string = await factory.getPair(wag.address, eth.address);
        pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);
        
        await wag.setPair(pair.address, true);

        let durations = [1200];
        let amountsMax = [tokens("10000")];
        const whitelistAddresses: string[] = [trader1.address, trader2.address]
        
        await wag.createLGEWhitelist(pair.address, durations, amountsMax);
        await wag.modifyLGEWhitelist(0, 1200, tokens("10000"), whitelistAddresses, true);

        await wag.approve(router.address, tokens("100000"));
        await eth.approve(router.address, ether("200"));
        await router.addLiquidity(wag.address, eth.address, tokens("100000"), ether("200"), 0, 0, owner.address, timeLimit(oneMinute*30));
        
        
        // Create the ADS, eth pool?
        await snapshot.snapshot();
    });

    afterEach("Revert", async () => {
        await snapshot.revert();
    })

    describe("Deployment", () => {

        it("should be called WAGYUSWAP.app", async () => {
            expect(await wag.name()).equal("WAGYUSWAP.app");
        });

        it("Should have the symbol WAG", async () => {
            expect(await wag.symbol()).equal("WAG");
        });
      
        it("Should have a total supply of 500000000", async () => {
            expect(await wag.totalSupply()).equal(tokens("500000000"));
        });
      
        it("Should have 18 decimals", async () => {
            expect(await wag.decimals()).equal(18);
        });
      
        it("Should give allowance to a spender of approved amount", async () => {
            await wag.approve(trader1.address, tokens("1000"));
            // let allowed = await wag.allowance(owner.address, trader1.address);

            expect(await wag.allowance(owner.address, trader1.address)).equal(tokens("1000"));
        });

        it("Should increase the allowance of a spender", async () => {
            await wag.increaseAllowance(trader1.address, tokens("2000"));
            expect(await wag.allowance(owner.address, trader1.address)).equal(tokens("2000"));
        });

        it("Should decrease the allowance of a spender", async () => {
            await wag.approve(trader1.address, tokens("4000"));
            await wag.decreaseAllowance(trader1.address, tokens("2000"));
            expect(await wag.allowance(owner.address, trader1.address)).equal(tokens("2000"));
        });

        // it("Should burn tokens", async () => {
        //     let initialBalance: BigNumber = await wag.balanceOf(owner.address);
        //     await wag.burn(tokens("1000"));
        //     expect(await wag.balanceOf(owner.address)).equal(initialBalance.sub(tokens("1000")));
        // });
    });

    describe("Trading", () => {

      it("should take a 10% fee when selling tokens on pancakeswap", async () => {
          let initialBalance: BigNumber = await wag.balanceOf(pair.address);

            // console.log(pair.address);
            // console.log(trader1.address);
            // console.log(router.address);

          expect(initialBalance).equal(tokens("100000"));

          await swapTokens(tokens("10000"), wag, eth, router, trader1);

            // pair adddress should increase by amount sold - 10% fee
            // expect(await wag.balanceOf(trader1.address)).equal(0);
          expect(await wag.balanceOf(pair.address)).equal(initialBalance.add(tokens("10000")));
      });
        
    });

    describe("allowance", () => {

        it("allowance works as expected", async () => {
          expect(await wag.allowance(owner.address, trader1.address)).equal(tokens("0"));
          await wag.approve(trader1.address, tokens("5"));
          expect(await wag.allowance(owner.address, trader1.address)).equal(tokens("5"));
          await wag.increaseAllowance(trader1.address, tokens("3"));
          expect(await wag.allowance(owner.address, trader1.address)).equal(tokens("8"));
          await wag.decreaseAllowance(trader1.address, tokens("4"));
          expect(await wag.allowance(owner.address, trader1.address)).equal(tokens("4"));
          await expect(wag.decreaseAllowance(trader1.address, tokens("5"))).revertedWith("ERC20: decreased allowance below zero");
          expect(await wag.allowance(owner.address, trader1.address)).equal(tokens("4"));
        });
    
      });
    
      describe("approve", () => {
    
        it("cannot approve the zero address to move your tokens", async () => {
          await expect(wag.connect(trader1).approve(ZeroAddress, tokens("5"))).to.be.reverted;
        });
    
        // it("zero address cannot approve burned tokens to be moved", async () => {
        //   const { vlx, holder5, ZeroAddress} = await deployWithTokenHolders();
        //   // Open github issue here
        //   await expect(vlx.connect(ZeroAddress).approve(holder5.address, tokens("5"))).to.be.reverted;
        // });
    
      });
    
      describe("transferFrom", () => {
    
        it("allows you transfer an address' tokens to another address", async () => {
          await wag.connect(trader1).approve(trader2.address, tokens("5"));
          await wag.connect(trader2).transferFrom(trader1.address, trader3.address, tokens("5"));
        });
    
      });
    
      describe("Ownership", () => {
    
        it("only the owner can transfer ownership to another address", async () => {
          await expect(wag.connect(trader1).transferOwnership(trader1.address)).to.be.reverted;
          await wag.transferOwnership(trader1.address);
          expect(await wag.owner()).to.be.equal(trader1.address);
        });
    
        it("owner cannot transfer ownership to the zero address", async () => {
          await expect(wag.transferOwnership(ZeroAddress)).to.be.reverted;
        });
    
        it("the owner can renounce ownership of the contract", async () => {
          await wag.renounceOwnership();
          expect(await wag.owner()).to.be.equal(ZeroAddress);
        });
    
      });
    
      describe("Whitelist", () => {
    
        it("creating the LGE whitelist requires duration and amountsMax of equal length", async () => {
          let durations = [1200];
          let amountsMax = [tokens("10000"), tokens("10")];
    
          await expect(wag.createLGEWhitelist(ZeroAddress, durations, amountsMax)).to.be.reverted;
    
          durations = [];
          amountsMax = [];
    
          await wag.createLGEWhitelist(ZeroAddress, durations, amountsMax); // shouldn't this revert since we're sending it the ZeroAddress?
        });
    
        it("Adding liquidity activates the whitelist", async () => {
          await swapTokens(ether("1"), eth, wag, router, trader1);
          await expect(swapTokens(ether("1"), eth, wag, router, trader3)).to.be.reverted;
        });
    
        it("transferring tokens reverts if you're not on the whitelist", async () => {
          await expect(swapTokens(ether("1"), eth, wag, router, trader3)).to.be.reverted;
        });
    
        it("whitelisters cannot buy more than the specified amount max", async () => {
          await expect(swapTokens(ether("9"), eth, wag, router, trader3)).to.be.reverted;
        });
    
        it("whitelist admin can add whitelist addresses using modifyLGEWhitelist", async () => {
          const addresses: string[] = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
          let data = await wag.getLGEWhitelistRound();
          expect(data[4]).equal(false);
          await wag.modifyLGEWhitelist(0, 1200, tokens("5000"), addresses, true);
          data = await wag.connect(trader3).getLGEWhitelistRound();
          expect(data[4]).equal(true);
        });
    
        it("whitelist admin can modify the whitelist duration", async () => {
          const addresses: string[] = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
          await wag.modifyLGEWhitelist(0, 1201, tokens("5000"), addresses, true);
        });
    
        it("whitelist admin can modify the max tokens that can be bought during the whitelist", async () => {
          const addresses = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
          await wag.modifyLGEWhitelist(0, 1200, tokens("5000"), addresses, true);
        });
    
        it("whitelist admin can call the modifyLGEWhitelist and not change anything", async () => {
          const addresses = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
          await wag.modifyLGEWhitelist(0, 1200, tokens("10000"), addresses, true);
        });
    
        it("when the whitelist round is over, getLGEWhitelistRound returns 0", async () => {
          let data = await wag.getLGEWhitelistRound();
          expect(data[0]).to.be.equal(1);
          await increaseTime(1500);
          data = await wag.getLGEWhitelistRound();
          expect(data[0]).to.be.equal(0);
        });
    
        it("whitelist admin cannot modify a whitelist that doesn't exist", async () => {
          const addresses = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
          await expect(wag.modifyLGEWhitelist(1, 1201, tokens("5000"), addresses, true)).to.be.reverted;
        });
    
        it("whitelist admin can renounce their whitelister permissions", async () => {
          await wag.renounceWhitelister();
          expect(await wag._whitelister()).to.be.equal(ZeroAddress);
        });
    
        it("whitelist admin can tranfer their whitelisting permission to another address", async () => {
          await expect(wag.connect(trader1).transferWhitelister(trader1.address)).to.be.reverted;
          await wag.transferWhitelister(trader1.address);
          expect(await wag._whitelister()).to.be.equal(trader1.address);
        });
    
        it("whitelist admin cannot transfer their whitelisting permission to the zero address", async () => {
          await expect(wag.transferWhitelister(ZeroAddress)).to.be.reverted;
          expect(await wag._whitelister()).to.be.equal(owner.address);
        });
    
    });

    describe("Configuration", async () => {
      it("Should allow owner to change the router", async () => {
        await wag.setRouter(trader1.address);
        expect(await wag._router()).equal(trader1.address);
      });
    
      it("Should not let the fees be greater than 20%", async () => {
        await expect(wag.setFees(2500, trader1.address)).revertedWith("Fees must not equal more than 20%");
      });

      it("Should not let fee reward address be the zero address", async () => {
        await expect(wag.setFees(1000, ZeroAddress)).revertedWith("Fee reward address must not be zero address");
      });

    });
});