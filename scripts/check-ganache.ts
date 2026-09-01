import { network } from "hardhat";

const { ethers } = await network.connect();
const [account] = await ethers.getSigners();
const balance = await ethers.provider.getBalance(account.address);

console.log("Address:", account.address);
console.log("Balance:", ethers.formatEther(balance), "ETH");
