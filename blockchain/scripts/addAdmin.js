/**
 * Helper script to add an admin address to the KYC contract
 * 
 * Usage:
 * 1. Make sure Ganache is running
 * 2. Set environment variables:
 *    - OWNER_ADDRESS: The address that deployed the contract (contract owner)
 *    - OWNER_KEY: The private key of the owner
 *    - ADMIN_ADDRESS_TO_ADD: The address you want to add as admin
 * 3. Run: node addAdmin.js
 */

const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

async function addAdmin() {
  try {
    // Load contract
    const contractPath = path.join(__dirname, '../build/contracts/KYC.json');
    if (!fs.existsSync(contractPath)) {
      console.error('Contract file not found. Please run "truffle compile" first.');
      process.exit(1);
    }
    
    const KYC = require(contractPath);
    const web3 = new Web3('http://localhost:7545');
    
    // Check connection
    try {
      await web3.eth.getBlockNumber();
    } catch (error) {
      console.error('Cannot connect to Ganache. Please ensure Ganache is running on http://localhost:7545');
      process.exit(1);
    }
    
    // Get network ID and contract address
    const netId = await web3.eth.net.getId();
    const networkInfo = KYC.networks[netId] || KYC.networks[String(netId)];
    
    if (!networkInfo || !networkInfo.address) {
      console.error(`Contract not deployed to network ${netId}. Please run "truffle migrate" first.`);
      process.exit(1);
    }
    
    const contractAddress = networkInfo.address;
    const contract = new web3.eth.Contract(KYC.abi, contractAddress);
    
    // Get environment variables
    const ownerAddress = process.env.OWNER_ADDRESS;
    const ownerKey = process.env.OWNER_KEY;
    const adminToAdd = process.env.ADMIN_ADDRESS_TO_ADD;
    
    if (!ownerAddress || !ownerKey) {
      console.error('Please set OWNER_ADDRESS and OWNER_KEY in your .env file');
      console.error('OWNER_ADDRESS should be the address that deployed the contract');
      process.exit(1);
    }
    
    if (!adminToAdd) {
      console.error('Please set ADMIN_ADDRESS_TO_ADD in your .env file');
      console.error('This is the address you want to add as an admin');
      process.exit(1);
    }
    
    // Verify owner address
    const contractOwner = await contract.methods.owner().call();
    console.log(`Contract owner: ${contractOwner}`);
    console.log(`Owner address from env: ${ownerAddress}`);
    
    if (contractOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
      console.error(`ERROR: OWNER_ADDRESS (${ownerAddress}) does not match contract owner (${contractOwner})`);
      console.error(`Please set OWNER_ADDRESS to: ${contractOwner}`);
      process.exit(1);
    }
    
    console.log(`\nAdding ${adminToAdd} as admin...`);
    
    // Create transaction to add admin
    const tx = contract.methods.addAdmin(adminToAdd);
    const gas = await tx.estimateGas({ from: ownerAddress });
    const gasPrice = await web3.eth.getGasPrice();
    const data = tx.encodeABI();
    const nonce = await web3.eth.getTransactionCount(ownerAddress);
    
    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: contractAddress,
        data,
        gas,
        gasPrice,
        nonce,
        chainId: netId,
      },
      ownerKey
    );
    
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log(`\n✅ Success! Admin added.`);
    console.log(`Transaction hash: ${receipt.transactionHash}`);
    console.log(`\nYou can now use ${adminToAdd} as ADMIN_ADDRESS in your .env file`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('already an admin')) {
      console.log(`\n✅ The address is already an admin. You can use it as ADMIN_ADDRESS.`);
    } else if (error.message.includes('Only Owner')) {
      console.error('\nThe address you provided is not the contract owner.');
      console.error('Please check your OWNER_ADDRESS and OWNER_KEY.');
    }
    process.exit(1);
  }
}

addAdmin();

