import { expect } from "chai";
import { Snapshot, tokens, timeLimit, increaseTime, ether }  from "./helpers";

// Types
import { WAG, UniswapV2Router02, UniswapV2Factory, WETH9, UniswapV2ERC20 } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"; 
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";


describe("Wagyu Swap ERC20 Contract Test Suite", () => {
    
    let wag: WAG, factory: UniswapV2Factory, router: UniswapV2Router02, eth: WETH9, pair: UniswapV2ERC20;
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
    }

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

        await wag.approve(router.address, tokens("100000"));
        await eth.approve(router.address, ether("200"));
        await router.addLiquidity(wag.address, eth.address, tokens("100000"), ether("200"), 0, 0, owner.address, timeLimit(oneMinute*30));

        let pairAddress: string = await factory.getPair(wag.address, eth.address);
        pair = await ethers.getContractAt("UniswapV2ERC20", pairAddress);

        await wag.setPair(pair.address, true);

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
            expect(await wag.balanceOf(pair.address)).equal(initialBalance.add(tokens("9000")));
        })
        
    });

});

// 110000000000000000000000
// 109000000000000000000000