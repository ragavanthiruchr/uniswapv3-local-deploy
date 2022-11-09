import { ethers } from "hardhat";
const WETH9 = require("../WETH9.json");
import { linkLibraries } from "./helper/linkLibraries";
import { encodePriceSqrt } from "./helper/encodePriceSqrt";
import { getPoolImmutables, getPoolState } from "./helper/util";
import { Token } from '@uniswap/sdk-core';
import { Pool, Position, nearestUsableTick } from '@uniswap/v3-sdk';

type ContractJson = { abi: any; bytecode: string };
const artifacts: { [name: string]: ContractJson } = {
  UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  SwapRouter: require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
  NFTDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
  NonfungibleTokenPositionDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
  WETH9,
};
const UniswapV3Pool = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json");

async function main() {
  const [owner, signer2, signer3] = await ethers.getSigners();
  console.log(`Deploying GBC & SBC Token contracts.......`);
  let Weth = new ethers.ContractFactory(artifacts.WETH9.abi, artifacts.WETH9.bytecode, owner);
  let weth = await Weth.deploy();
  console.log('weth', weth.address);

  let GoldBarToken = await ethers.getContractFactory("GoldBarToken", owner);
  let goldBarToken = await GoldBarToken.deploy();
  console.log('goldBarToken', goldBarToken.address);
  goldBarToken.connect(owner).mint(signer2.address, ethers.utils.parseEther('1000000'));
  goldBarToken.connect(owner).mint(signer3.address, ethers.utils.parseEther('1000000'));

  let SilverBarToken = await ethers.getContractFactory("SilverBarToken", owner);
  let silverBarToken = await SilverBarToken.deploy();
  console.log('silverBarToken', silverBarToken.address);
  silverBarToken.connect(owner).mint(signer2.address, ethers.utils.parseEther('1000000'));

  console.log(`Deploying Uniswap contracts.......`);
  let UniswapV3Factory = new ethers.ContractFactory(artifacts.UniswapV3Factory.abi, artifacts.UniswapV3Factory.bytecode, owner);
  let uniswapV3Factory = await UniswapV3Factory.deploy();
  console.log('uniswapV3Factory', uniswapV3Factory.address);

  let SwapRouter = new ethers.ContractFactory(artifacts.SwapRouter.abi, artifacts.SwapRouter.bytecode, owner);
  let swapRouter = await SwapRouter.deploy(uniswapV3Factory.address, weth.address);
  console.log('swapRouter', swapRouter.address);

  let NFTDescriptor = new ethers.ContractFactory(artifacts.NFTDescriptor.abi, artifacts.NFTDescriptor.bytecode, owner);
  let nftDescriptor = await NFTDescriptor.deploy();
  console.log('nftDescriptor', nftDescriptor.address);

  const linkedBytecode = linkLibraries(
    {
      bytecode: artifacts.NonfungibleTokenPositionDescriptor.bytecode,
      linkReferences: {
        "NFTDescriptor.sol": {
          NFTDescriptor: [
            {
              length: 20,
              start: 1261,
            },
          ],
        },
      },
    },
    {
      NFTDescriptor: nftDescriptor.address,
    }
  );
  let NonfungibleTokenPositionDescriptor = new ethers.ContractFactory(artifacts.NonfungibleTokenPositionDescriptor.abi, linkedBytecode, owner);
  let nonfungibleTokenPositionDescriptor = await NonfungibleTokenPositionDescriptor.deploy(weth.address);
  console.log('nonfungibleTokenPositionDescriptor', nonfungibleTokenPositionDescriptor.address);

  let NonfungiblePositionManager = new ethers.ContractFactory(artifacts.NonfungiblePositionManager.abi, artifacts.NonfungiblePositionManager.bytecode, owner);
  let nonfungiblePositionManager = await NonfungiblePositionManager.deploy(uniswapV3Factory.address, weth.address, nonfungibleTokenPositionDescriptor.address);
  console.log('nonfungiblePositionManager', nonfungiblePositionManager.address);

  console.log(`Creating a pool for GBC/SBC.......`);
  const sqrtPrice = encodePriceSqrt(1, 1);

  await nonfungiblePositionManager.connect(owner).createAndInitializePoolIfNecessary(silverBarToken.address, goldBarToken.address, 500, sqrtPrice, { gasLimit: 5000000 });
  const poolAddress = await uniswapV3Factory.connect(owner).getPool(silverBarToken.address, goldBarToken.address, 500);
  console.log('poolAddress', poolAddress);

  const poolContract: any = new ethers.Contract(poolAddress, UniswapV3Pool.abi, ethers.provider);

  console.log('---------------------------------------------');
  console.log(`fee `, await poolContract.fee());
  console.log(`slot0 `, await poolContract.slot0());
  console.log(`liquidity `, await poolContract.liquidity());
  console.log('---------------------------------------------');

  console.log(`Approving GBC & SBC to Uniswap.......`);
  await goldBarToken.connect(signer2).approve(nonfungiblePositionManager.address, ethers.utils.parseEther('20000'));
  await silverBarToken.connect(signer2).approve(nonfungiblePositionManager.address, ethers.utils.parseEther('10000'));

  const poolData = await getPoolData(poolContract)
  console.log(`poolData `, poolData);

  console.log(`Creating liquidity for GBC/SBC in Uniswap by Signer2(LP).......`);
  const GoldToken = new Token(31337, goldBarToken.address, 18, 'GBC', 'Gold Bar Token')
  const SilverToken = new Token(31337, silverBarToken.address, 18, 'SBC', 'Silver Bar Token')

  const pool = new Pool(
    GoldToken,
    SilverToken,
    poolData.fee,
    poolData.sqrtPriceX96.toString(),
    poolData.liquidity.toString(),
    poolData.tick
  );

  const position = new Position({
    pool: pool,
    liquidity: ethers.utils.parseEther('10000'),
    tickLower: nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 2,
    tickUpper: nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 2,
  });

  const { amount0: amount0Desired, amount1: amount1Desired } = position.mintAmounts
  //console.log(`position:`, position);
  console.log(`amount0Desired:`, amount0Desired);
  //console.log(`amount1Desired:`, amount1Desired);
  let params = {
    token0: silverBarToken.address,
    token1: goldBarToken.address,
    fee: poolData.fee,
    tickLower: nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 2,
    tickUpper: nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 2,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: 0,
    amount1Min: 0,
    recipient: signer2.address,
    deadline: Math.floor(Date.now() / 1000) + (60 * 10)
  }

  const tx = await nonfungiblePositionManager.connect(signer2).mint(
    params,
    { gasLimit: '5000000' }
  )
  const receipt = await tx.wait();
  //console.log(`receipt `, receipt);
  console.log('---------------------------------------------');
  console.log(`fee `, await poolContract.fee());
  console.log(`slot0 `, await poolContract.slot0());
  console.log(`liquidity `, await poolContract.liquidity());
  console.log('---------------------------------------------');
  const poolData1 = await getPoolData(poolContract)
  console.log(`poolData1 `, poolData1);


  console.log(`User(Signer3) approve for GBC for Uniswap.......`);
  const immutables = await getPoolImmutables(poolContract)
  const state = await getPoolState(poolContract)

  const inputAmount = 1;
  // .001 => 1 000 000 000 000 000
  const amountIn = ethers.utils.parseEther(inputAmount.toString());
  const approvalResponse = await goldBarToken.connect(signer3).approve(
    swapRouter.address,
    ethers.utils.parseEther('10000')
  )

  let params1 = {
    tokenIn: immutables.token1,
    tokenOut: immutables.token0,
    fee: immutables.fee,
    recipient: signer3.address,
    deadline: Math.floor(Date.now() / 1000) + (60 * 10),
    amountIn: amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  }

  console.log();
  console.log();
  console.log(`LP(Signer2) SBC Balance:`, ethers.utils.formatEther((await silverBarToken.balanceOf(signer2.address))));
  console.log(`LP(Signer2) GBC Balance:`, ethers.utils.formatEther((await goldBarToken.balanceOf(signer2.address))));
  console.log(`LP(Signer2) Approval GBC Balance:`, ethers.utils.formatEther((await goldBarToken.allowance(signer2.address, nonfungiblePositionManager.address))));
  console.log(`LP(Signer2) Approval SBC Balance:`, ethers.utils.formatEther((await silverBarToken.allowance(signer2.address, nonfungiblePositionManager.address))));

  console.log(`User(Signer3) SBC Balance:`, ethers.utils.formatEther((await silverBarToken.balanceOf(signer3.address))));
  console.log(`User(Signer3) GBC Balance:`, ethers.utils.formatEther((await goldBarToken.balanceOf(signer3.address))));
  console.log(`User(Signer3) Approval GBC Balance:`, ethers.utils.formatEther((await goldBarToken.allowance(signer3.address, nonfungiblePositionManager.address))));

  // console.log(`Pool state: `, await getPoolState(poolContract));
  console.log();
  console.log(ethers.utils.parseEther('1000000'));
  console.log(`User(Signer3) swap ${amountIn} GBC for SBC for Uniswap.......`);
  let transaction: any = await swapRouter.connect(signer3).exactInputSingle(
    params1,
    {
      gasLimit: 1000000
    }
  );
  console.log(`LP(Signer2) SBC Balance:`, ethers.utils.formatEther((await silverBarToken.balanceOf(signer2.address))));
  console.log(`LP(Signer2) GBC Balance:`, ethers.utils.formatEther((await goldBarToken.balanceOf(signer2.address))));
  console.log(`LP(Signer2) Approval GBC Balance:`, ethers.utils.formatEther((await goldBarToken.allowance(signer2.address, nonfungiblePositionManager.address))));
  console.log(`LP(Signer2) Approval SBC Balance:`, ethers.utils.formatEther((await silverBarToken.allowance(signer2.address, nonfungiblePositionManager.address))));
  console.log(`User(Signer3) SBC Balance:`, ethers.utils.formatEther((await silverBarToken.balanceOf(signer3.address))));
  console.log(`User(Signer3) GBC Balance:`, ethers.utils.formatEther((await goldBarToken.balanceOf(signer3.address))));

  //console.log(`Pool state: `, await getPoolState(poolContract));


}

async function getPoolData(poolContract: any) {
  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ])

  return {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
  }
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
