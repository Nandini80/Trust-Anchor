const Web3 = require("web3");
const fs = require("fs");
const path = require("path");

// Try to load contract, but don't fail if it doesn't exist
let MyConc = null;
const contractPath = path.join(__dirname, "../../../blockchain/build/contracts/KYC.json");
try {
  if (fs.existsSync(contractPath)) {
    MyConc = require(contractPath);
  } else {
    console.warn("Blockchain contract file not found at:", contractPath);
    console.warn("Blockchain features will be disabled. Run 'truffle compile' and 'truffle migrate' to enable.");
  }
} catch (error) {
  console.warn("Error loading blockchain contract:", error.message);
}

const adminAddress = process.env.ADMIN_ADDRESS;
const adminKey = process.env.ADMIN_KEY;

module.exports.getDetails = async (kycId) => {
  if (!MyConc) {
    throw new Error("Blockchain contract not available. Please compile and migrate contracts.");
  }
  const web3 = new Web3("http://localhost:7545");
  const netId = await web3.eth.net.getId();
  
  // Check if contract is deployed to this network
  if (!MyConc.networks || !MyConc.networks[netId] || !MyConc.networks[netId].address) {
    throw new Error(`Contract not deployed to network ${netId}. Please run 'truffle migrate' to deploy the contract.`);
  }
  
  const conc = new web3.eth.Contract(MyConc.abi, MyConc.networks[netId].address);
  const data = await conc.methods.getCustomerDetails(kycId).call({ from: adminAddress });
  return data;
};

module.exports.getReqList = async (kycId) => {
  if (!MyConc) {
    throw new Error("Blockchain contract not available. Please compile and migrate contracts.");
  }
  const web3 = new Web3("http://localhost:7545");
  const netId = await web3.eth.net.getId();
  
  // Check if contract is deployed to this network
  if (!MyConc.networks || !MyConc.networks[netId] || !MyConc.networks[netId].address) {
    throw new Error(`Contract not deployed to network ${netId}. Please run 'truffle migrate' to deploy the contract.`);
  }
  
  const conc = new web3.eth.Contract(MyConc.abi, MyConc.networks[netId].address);
  const data = await conc.methods.getClientData(kycId).call({ from: adminAddress });
  return data;
};

module.exports.handelRequest = async (kycId, bAddress, response) => {
  if (!MyConc) {
    throw new Error("Blockchain contract not available. Please compile and migrate contracts.");
  }
  const web3 = new Web3("http://localhost:7545");
  const netId = await web3.eth.net.getId();
  
  // Check if contract is deployed to this network
  if (!MyConc.networks || !MyConc.networks[netId] || !MyConc.networks[netId].address) {
    throw new Error(`Contract not deployed to network ${netId}. Please run 'truffle migrate' to deploy the contract.`);
  }
  
  const conc = new web3.eth.Contract(MyConc.abi, MyConc.networks[netId].address);

  const tx = conc.methods.manageRequest(kycId, bAddress, response);
  const gas = await tx.estimateGas({ from: adminAddress });
  const gasPrice = await web3.eth.getGasPrice();
  const data = tx.encodeABI();
  const nonce = await web3.eth.getTransactionCount(adminAddress);

  const signedTx = await web3.eth.accounts.signTransaction(
    {
      to: conc.options.address,
      data,
      gas,
      gasPrice,
      nonce,
      chainId: netId,
    },
    adminKey
  );

  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  return receipt;
};

module.exports.registerCustomer = async (formData,kycId) => {
  if (!MyConc) {
    throw new Error("Blockchain contract not available. Please compile and migrate contracts.");
  }
  
  // Check if networks object exists
  if (!MyConc.networks || typeof MyConc.networks !== 'object') {
    throw new Error("Contract networks not found. Please run 'truffle migrate' to deploy the contract.");
  }
  
  try {
    const web3 = new Web3("http://localhost:7545");
    
    // Check if Web3 can connect
    try {
      await web3.eth.getBlockNumber();
    } catch (connectionError) {
      throw new Error(`Cannot connect to Ethereum node at http://localhost:7545. Please ensure Ganache or your Ethereum node is running.`);
    }
    
    const netId = await web3.eth.net.getId();
    
    // Check if contract is deployed to this network
    if (!MyConc.networks[netId]) {
      throw new Error(`Contract not deployed to network ${netId}. Available networks: ${Object.keys(MyConc.networks).join(', ')}. Please run 'truffle migrate' to deploy the contract.`);
    }
    
    if (!MyConc.networks[netId].address) {
      throw new Error(`Contract address not found for network ${netId}. Please run 'truffle migrate' to deploy the contract.`);
    }
    
    // Validate ABI exists
    if (!MyConc.abi || !Array.isArray(MyConc.abi)) {
      throw new Error("Contract ABI not found or invalid. Please run 'truffle compile' to generate the contract ABI.");
    }
    
    const contractAddress = MyConc.networks[netId].address;
    const conc = new web3.eth.Contract(MyConc.abi, contractAddress);
    
    // Verify contract was created properly
    if (!conc || !conc.options || !conc.options.address) {
      throw new Error(`Failed to create contract instance. Address: ${contractAddress}`);
    }
    
    const tx = conc.methods.addCustomer(
      formData.name,
      formData.phone,
      formData.address,
      formData.gender,
      formData.dob,
      formData.PANno,
      kycId,
      formData.geo,
      formData.selfieIPFS,
      formData.aadharIPFS,
      formData.panIPFS    
    )

    const gas = await tx.estimateGas({ from: adminAddress });
    const gasPrice = await web3.eth.getGasPrice();
    const data = tx.encodeABI();
    const nonce = await web3.eth.getTransactionCount(adminAddress);

    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: conc.options.address,
        data,
        gas,
        gasPrice,
        nonce,
        chainId: netId,
      },
      adminKey
    );

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    return receipt;
  } catch (error) {
    // Re-throw with more context
    throw new Error(`Blockchain registration failed: ${error.message}`);
  }
};


module.exports.updateRecordBC = async (kycId,record_type,record_data) => {
  if (!MyConc) {
    throw new Error("Blockchain contract not available. Please compile and migrate contracts.");
  }
  const web3 = new Web3("http://localhost:7545");
  const netId = await web3.eth.net.getId();
  
  // Check if contract is deployed to this network
  if (!MyConc.networks || !MyConc.networks[netId] || !MyConc.networks[netId].address) {
    throw new Error(`Contract not deployed to network ${netId}. Please run 'truffle migrate' to deploy the contract.`);
  }
  
  const conc = new web3.eth.Contract(MyConc.abi, MyConc.networks[netId].address);
  const tx = conc.methods.updateRecord(
    kycId,
    record_type,
    record_data       
  )

  const gas = await tx.estimateGas({ from: adminAddress });
  const gasPrice = await web3.eth.getGasPrice();
  const data = tx.encodeABI();
  const nonce = await web3.eth.getTransactionCount(adminAddress);

  const signedTx = await web3.eth.accounts.signTransaction(
    {
      to: conc.options.address,
      data,
      gas,
      gasPrice,
      nonce,
      chainId: netId,
    },
    adminKey
  );

  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  return receipt;
};


